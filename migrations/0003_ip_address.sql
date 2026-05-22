ALTER TABLE items ADD COLUMN ip_address TEXT;
CREATE INDEX IF NOT EXISTS idx_items_ip_address ON items (ip_address);
