import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  SHARE_PASSWORD: string;
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
  created_at: number;
  updated_at: number;
};

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

// 简单口令校验中间件:除了 /api/auth/verify 之外都要带 Authorization
app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/auth/verify") return next();

  const auth = c.req.header("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!c.env.SHARE_PASSWORD || token !== c.env.SHARE_PASSWORD) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return next();
});

function shapeItem(row: ItemRow, origin: string) {
  return {
    ...row,
    classes: row.classes ? row.classes.split(",").filter(Boolean) : [],
    image_url: `${origin}/img/${encodeURIComponent(row.image_key)}`,
  };
}

// 校验口令
app.post("/api/auth/verify", async (c) => {
  const { password } = await c.req.json<{ password?: string }>();
  if (!c.env.SHARE_PASSWORD) {
    return c.json({ ok: false, error: "server password not configured" }, 500);
  }
  if (password !== c.env.SHARE_PASSWORD) {
    return c.json({ ok: false, error: "wrong password" }, 401);
  }
  return c.json({ ok: true });
});

// 列出所有装备
app.get("/api/items", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM items ORDER BY created_at DESC LIMIT 500"
  ).all<ItemRow>();

  const origin = new URL(c.req.url).origin;
  return c.json({ items: results.map((r) => shapeItem(r, origin)) });
});

// 上传装备截图 + 元信息(multipart/form-data)
app.post("/api/items", async (c) => {
  const form = await c.req.formData();
  const nickname = String(form.get("nickname") || "").trim();
  const itemName = String(form.get("item_name") || "").trim() || null;
  const note = String(form.get("note") || "").trim() || null;
  const category = String(form.get("category") || "").trim() || null;
  const quality = String(form.get("quality") || "").trim() || null;
  // classes 由前端拼成逗号分隔
  const classes = String(form.get("classes") || "").trim() || null;
  const file = form.get("image");

  if (!nickname) return c.json({ error: "nickname required" }, 400);
  if (!(file instanceof File)) return c.json({ error: "image required" }, 400);
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: "image too large (max 10MB)" }, 400);
  }

  const ext = (file.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
  const key = `items/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "image/png" },
  });

  const now = Date.now();
  const result = await c.env.DB.prepare(
    `INSERT INTO items (nickname, item_name, note, image_key, category, quality, classes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(nickname, itemName, note, key, category, quality, classes, now, now)
    .run();

  const id = result.meta.last_row_id;
  const row = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?")
    .bind(id)
    .first<ItemRow>();

  if (!row) return c.json({ error: "insert failed" }, 500);
  const origin = new URL(c.req.url).origin;
  return c.json({ item: shapeItem(row, origin) });
});

// 标记被谁领走
app.patch("/api/items/:id/claim", async (c) => {
  const id = Number(c.req.param("id"));
  const { claimed_by } = await c.req.json<{ claimed_by?: string | null }>();
  await c.env.DB.prepare(
    "UPDATE items SET claimed_by = ?, updated_at = ? WHERE id = ?"
  )
    .bind(claimed_by || null, Date.now(), id)
    .run();
  return c.json({ ok: true });
});

// 删除一条(连同图片)
app.delete("/api/items/:id", async (c) => {
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
