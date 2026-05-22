import { useState } from "react";
import {
  CATEGORY_LABELS,
  CHAR_CLASS_LABELS,
  QUALITY_COLORS,
  QUALITY_LABELS,
  type Item,
} from "../../shared/types";
import { claimItem, deleteItem } from "../api";

export function ItemCard({
  item,
  currentNickname,
  onChanged,
  onDeleted,
}: {
  item: Item;
  currentNickname: string;
  onChanged: (item: Item) => void;
  onDeleted: (id: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const isOwner = item.nickname === currentNickname;
  const isClaimed = !!item.claimed_by;
  const claimedByMe = item.claimed_by === currentNickname;

  async function toggleClaim() {
    setBusy(true);
    try {
      const next = isClaimed ? null : currentNickname;
      await claimItem(item.id, next);
      onChanged({
        ...item,
        claimed_by: next,
        updated_at: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("确认删除这条?")) return;
    setBusy(true);
    try {
      await deleteItem(item.id);
      onDeleted(item.id);
    } finally {
      setBusy(false);
    }
  }

  const time = new Date(item.created_at).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemNameColor = item.quality ? QUALITY_COLORS[item.quality] : undefined;

  return (
    <div className={`card ${isClaimed ? "claimed" : ""}`}>
      <div className="img">
        <a href={item.image_url} target="_blank" rel="noreferrer">
          <img src={item.image_url} alt={item.item_name || "装备"} />
        </a>
      </div>
      <div className="body">
        <div className="nick">
          {item.nickname}
          {isClaimed && (
            <span className="badge" style={{ marginLeft: 8 }}>
              {item.claimed_by} 已领走
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
          <span>{time}</span>
        </div>
      </div>
      <div className="actions">
        <button onClick={toggleClaim} disabled={busy}>
          {claimedByMe ? "撤销领取" : isClaimed ? "改成我要" : "我要"}
        </button>
        {(isOwner || claimedByMe) && (
          <button className="danger" onClick={remove} disabled={busy}>
            删除
          </button>
        )}
      </div>
    </div>
  );
}
