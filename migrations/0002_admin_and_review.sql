-- 软删除 + AI 审核标记
ALTER TABLE items ADD COLUMN deleted_at INTEGER;
ALTER TABLE items ADD COLUMN deleted_by TEXT;
ALTER TABLE items ADD COLUMN claimed_at INTEGER;
ALTER TABLE items ADD COLUMN ai_review TEXT;        -- "approved" | "suspicious" | "skipped"
ALTER TABLE items ADD COLUMN ai_review_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items (deleted_at);
CREATE INDEX IF NOT EXISTS idx_items_ai_review ON items (ai_review);
