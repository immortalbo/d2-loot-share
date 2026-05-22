import { useState } from "react";
import {
  CATEGORY_LABELS,
  CHAR_CLASS_LABELS,
  QUALITY_COLORS,
  QUALITY_LABELS,
  type Item,
} from "../../shared/types";
import {
  adminApproveItem,
  adminHardDeleteItem,
  adminRestoreItem,
  claimItem,
  deleteItem,
} from "../api";

export function ItemCard({
  item,
  currentNickname,
  isAdmin,
  onChanged,
  onDeleted,
}: {
  item: Item;
  currentNickname: string;
  isAdmin: boolean;
  onChanged: (item: Item) => void;
  onDeleted: (id: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const isOwner = item.nickname === currentNickname;
  const isClaimed = !!item.claimed_by;
  const claimedByMe = item.claimed_by === currentNickname;
  const isDeleted = !!item.deleted_at;
  const isSuspicious = item.ai_review === "suspicious";

  async function toggleClaim() {
    setBusy(true);
    try {
      const next = isClaimed ? null : currentNickname;
      await claimItem(item.id, next);
      onChanged({
        ...item,
        claimed_by: next,
        claimed_at: next ? Date.now() : null,
        updated_at: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  async function softDelete() {
    if (!confirm("确认删除这条?")) return;
    setBusy(true);
    try {
      await deleteItem(item.id, currentNickname);
      onDeleted(item.id);
    } finally {
      setBusy(false);
    }
  }

  async function adminHardDelete() {
    if (!confirm("⚠️ 这是永久删除(同时删图片),不可恢复。确认?")) return;
    setBusy(true);
    try {
      await adminHardDeleteItem(item.id);
      onDeleted(item.id);
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      await adminRestoreItem(item.id);
      onChanged({
        ...item,
        deleted_at: null,
        deleted_by: null,
        updated_at: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    try {
      await adminApproveItem(item.id);
      onChanged({
        ...item,
        ai_review: "approved",
        updated_at: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  const fmt = (t: number | null | undefined) =>
    t
      ? new Date(t).toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const itemNameColor = item.quality ? QUALITY_COLORS[item.quality] : undefined;

  return (
    <div
      className={`card ${isClaimed ? "claimed" : ""} ${
        isDeleted ? "deleted" : ""
      } ${isSuspicious ? "suspicious" : ""}`}
    >
      <div className="img">
        <a href={item.image_url} target="_blank" rel="noreferrer">
          <img src={item.image_url} alt={item.item_name || "装备"} />
        </a>
        {isSuspicious && isAdmin && (
          <div className="badge-overlay">AI 标记可疑</div>
        )}
      </div>
      <div className="body">
        <div className="nick">
          {item.nickname}
          {isClaimed && (
            <span className="badge" style={{ marginLeft: 8 }}>
              {item.claimed_by} 已领
            </span>
          )}
          {isDeleted && (
            <span className="badge badge-danger" style={{ marginLeft: 8 }}>
              已删除
            </span>
          )}
        </div>
        {item.item_name && (
          <div className="item-name" style={{ color: itemNameColor }}>
            {item.item_name}
          </div>
        )}

        <div className="tags">
          {item.category && (
            <span className="tag">{CATEGORY_LABELS[item.category]}</span>
          )}
          {item.quality && (
            <span
              className="tag"
              style={{
                borderColor: QUALITY_COLORS[item.quality],
                color: QUALITY_COLORS[item.quality],
              }}
            >
              {QUALITY_LABELS[item.quality]}
            </span>
          )}
          {item.classes.map((cls) => (
            <span key={cls} className="tag tag-class">
              {CHAR_CLASS_LABELS[cls]}
            </span>
          ))}
        </div>

        {item.note && <div className="note">{item.note}</div>}

        <div className="meta">
          <span>发布 {fmt(item.created_at)}</span>
        </div>

        {isAdmin && (
          <div className="meta admin-meta">
            {item.ip_address && (
              <span>
                IP <code>{item.ip_address}</code>
              </span>
            )}
            {item.claimed_at && (
              <span>
                领取 {fmt(item.claimed_at)} ({item.claimed_by})
              </span>
            )}
            {isDeleted && (
              <span>
                删除 {fmt(item.deleted_at)} ({item.deleted_by})
              </span>
            )}
            {isSuspicious && (
              <span className="ai-reason" title={item.ai_review_reason || ""}>
                OCR: {(item.ai_review_reason || "").slice(0, 80)}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="actions">
        {!isDeleted && (
          <button onClick={toggleClaim} disabled={busy}>
            {claimedByMe ? "撤销领取" : isClaimed ? "改成我要" : "我要"}
          </button>
        )}
        {!isDeleted && (isOwner || claimedByMe || isAdmin) && (
          <button className="danger" onClick={softDelete} disabled={busy}>
            删除
          </button>
        )}
        {isAdmin && isSuspicious && !isDeleted && (
          <button
            onClick={approve}
            disabled={busy}
            title="把这条标记为已审核,普通用户就能看到了"
          >
            展示给所有人
          </button>
        )}
        {isAdmin && isDeleted && (
          <button onClick={restore} disabled={busy}>
            恢复
          </button>
        )}
        {isAdmin && (
          <button
            className="danger"
            onClick={adminHardDelete}
            disabled={busy}
            title="永久删除(连图片一起删)"
          >
            永久删
          </button>
        )}
      </div>
    </div>
  );
}
