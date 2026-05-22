import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  AI: Ai;
  SHARE_PASSWORD: string;
  ADMIN_PASSWORD?: string;
};

type ItemRow = {
  id: number;
  nickname: string;
  item_name: string | null;
  note: string | null;
  image_key: string;
  category: string | null;
  quality: string | null;
  classes: string | null;
  claimed_by: string | null;
  claimed_at: number | null;
  deleted_at: number | null;
  deleted_by: string | null;
  ai_review: string | null;
  ai_review_reason: string | null;
  ip_address: string | null;
  created_at: number;
  updated_at: number;
};

type Role = "user" | "admin";

type Variables = { role: Role };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("/api/*", cors());

// 鉴权:区分 user / admin
app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/auth/verify") return next();

  const auth = c.req.header("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return c.json({ error: "unauthorized" }, 401);

  if (c.env.ADMIN_PASSWORD && token === c.env.ADMIN_PASSWORD) {
    c.set("role", "admin");
  } else if (c.env.SHARE_PASSWORD && token === c.env.SHARE_PASSWORD) {
    c.set("role", "user");
  } else {
    return c.json({ error: "unauthorized" }, 401);
  }
  return next();
});

function shapeItem(row: ItemRow, origin: string, role: Role) {
  // 普通用户不暴露 IP 和 AI 审核理由(可能含敏感的 OCR 内容)
  const stripped =
    role === "admin"
      ? row
      : { ...row, ip_address: null, ai_review_reason: null };
  return {
    ...stripped,
    classes: stripped.classes
      ? stripped.classes.split(",").filter(Boolean)
      : [],
    image_url: `${origin}/img/${encodeURIComponent(stripped.image_key)}`,
  };
}

// 校验口令,返回 role
app.post("/api/auth/verify", async (c) => {
  const { password } = await c.req.json<{ password?: string }>();
  if (!c.env.SHARE_PASSWORD) {
    return c.json({ ok: false, error: "server password not configured" }, 500);
  }
  if (c.env.ADMIN_PASSWORD && password === c.env.ADMIN_PASSWORD) {
    return c.json({ ok: true, role: "admin" as Role });
  }
  if (password === c.env.SHARE_PASSWORD) {
    return c.json({ ok: true, role: "user" as Role });
  }
  return c.json({ ok: false, error: "wrong password" }, 401);
});

// 列出装备
// - 普通用户:只看到未删除 且 (ai_review != 'suspicious')
// - admin:?include=deleted 时看全部,否则只看未删除(但能看到 suspicious)
app.get("/api/items", async (c) => {
  const role = c.get("role") as Role;

  let sql: string;
  if (role === "admin") {
    sql =
      c.req.query("include") === "deleted"
        ? "SELECT * FROM items ORDER BY created_at DESC LIMIT 1000"
        : "SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1000";
  } else {
    sql =
      "SELECT * FROM items WHERE deleted_at IS NULL AND (ai_review IS NULL OR ai_review != 'suspicious') ORDER BY created_at DESC LIMIT 500";
  }

  const { results } = await c.env.DB.prepare(sql).all<ItemRow>();
  const origin = new URL(c.req.url).origin;
  return c.json({ items: results.map((r) => shapeItem(r, origin, role)) });
});

import { reviewOcrText } from "../shared/d2-keywords";

function reviewByOcrText(ocrText: string): {
  ok: boolean;
  reason: string;
} {
  if (!ocrText) {
    return { ok: false, reason: "OCR text empty (client may have skipped)" };
  }
  const r = reviewOcrText(ocrText);
  const textSnip = ocrText.replace(/\s+/g, " ").slice(0, 200);
  if (r.ok) {
    return { ok: true, reason: `matched "${r.matched}". OCR: ${textSnip}` };
  }
  return { ok: false, reason: `no D2 keyword matched. OCR: ${textSnip}` };
}

// 上传装备截图
app.post("/api/items", async (c) => {
  const form = await c.req.formData();
  const nickname = String(form.get("nickname") || "").trim();
  const itemName = String(form.get("item_name") || "").trim() || null;
  const note = String(form.get("note") || "").trim() || null;
  const category = String(form.get("category") || "").trim() || null;
  const quality = String(form.get("quality") || "").trim() || null;
  const classes = String(form.get("classes") || "").trim() || null;
  const ocrText = String(form.get("ocr_text") || "").trim();
  const file = form.get("image");

  if (!nickname) return c.json({ error: "nickname required" }, 400);
  if (!(file instanceof File)) return c.json({ error: "image required" }, 400);
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: "image too large (max 10MB)" }, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const review = reviewByOcrText(ocrText);
  const ai_review = review.ok ? "approved" : "suspicious";
  const ai_review_reason = review.reason;

  // Cloudflare 自动注入真实客户端 IP
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0].trim() ||
    null;

  const ext = (file.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
  const key = `items/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await c.env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: file.type || "image/png" },
  });

  const now = Date.now();
  const result = await c.env.DB.prepare(
    `INSERT INTO items
       (nickname, item_name, note, image_key, category, quality, classes,
        ai_review, ai_review_reason, ip_address, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      nickname,
      itemName,
      note,
      key,
      category,
      quality,
      classes,
      ai_review,
      ai_review_reason,
      ip,
      now,
      now
    )
    .run();

  const id = result.meta.last_row_id;
  const row = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?")
    .bind(id)
    .first<ItemRow>();

  if (!row) return c.json({ error: "insert failed" }, 500);
  const origin = new URL(c.req.url).origin;
  // 返回给上传者:让前端能根据 ai_review 给用户「需要审核」提示。普通用户也保留 ai_review 字段
  return c.json({ item: shapeItem(row, origin, c.get("role") as Role) });
});

// 标记领取
app.patch("/api/items/:id/claim", async (c) => {
  const id = Number(c.req.param("id"));
  const { claimed_by } = await c.req.json<{ claimed_by?: string | null }>();
  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE items SET claimed_by = ?, claimed_at = ?, updated_at = ? WHERE id = ?"
  )
    .bind(claimed_by || null, claimed_by ? now : null, now, id)
    .run();
  return c.json({ ok: true });
});

// 软删除
app.delete("/api/items/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const by = c.req.query("by") || "unknown";
  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE items SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL"
  )
    .bind(now, by, now, id)
    .run();
  return c.json({ ok: true });
});

// ---- 管理员接口 ----

// 把可疑条目批准展示给所有人(ai_review: suspicious -> approved)
app.post("/api/admin/items/:id/approve", async (c) => {
  if (c.get("role") !== "admin")
    return c.json({ error: "admin only" }, 403);
  const id = Number(c.req.param("id"));
  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE items SET ai_review = 'approved', ai_review_reason = COALESCE(ai_review_reason, '') || ' [admin approved]', updated_at = ? WHERE id = ?"
  )
    .bind(now, id)
    .run();
  return c.json({ ok: true });
});

app.post("/api/admin/items/:id/restore", async (c) => {
  if (c.get("role") !== "admin")
    return c.json({ error: "admin only" }, 403);
  const id = Number(c.req.param("id"));
  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE items SET deleted_at = NULL, deleted_by = NULL, updated_at = ? WHERE id = ?"
  )
    .bind(now, id)
    .run();
  return c.json({ ok: true });
});

app.delete("/api/admin/items/:id", async (c) => {
  if (c.get("role") !== "admin")
    return c.json({ error: "admin only" }, 403);
  const id = Number(c.req.param("id"));
  const row = await c.env.DB.prepare("SELECT image_key FROM items WHERE id = ?")
    .bind(id)
    .first<{ image_key: string }>();
  if (row?.image_key) {
    await c.env.IMAGES.delete(row.image_key).catch(() => {});
  }
  await c.env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

// 图片代理
app.get("/img/:key{.+}", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  const obj = await c.env.IMAGES.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType || "image/png",
      "cache-control": "public, max-age=31536000, immutable",
      etag: obj.httpEtag,
    },
  });
});

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
