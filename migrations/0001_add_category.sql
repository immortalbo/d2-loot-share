-- 给现有 items 表加分类字段(D1 远程执行用)
ALTER TABLE items ADD COLUMN category TEXT;
ALTER TABLE items ADD COLUMN quality TEXT;
ALTER TABLE items ADD COLUMN classes TEXT;
CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);
