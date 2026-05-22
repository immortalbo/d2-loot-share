CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  item_name TEXT,
  note TEXT,
  image_key TEXT NOT NULL,
  category TEXT,
  quality TEXT,
  classes TEXT,
  claimed_by TEXT,
  claimed_at INTEGER,
  deleted_at INTEGER,
  deleted_by TEXT,
  ai_review TEXT,
  ai_review_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_nickname ON items (nickname);
CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);
CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items (deleted_at);
CREATE INDEX IF NOT EXISTS idx_items_ai_review ON items (ai_review);
