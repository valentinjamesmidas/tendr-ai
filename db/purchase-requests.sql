CREATE TABLE IF NOT EXISTS customer_purchase_requests (
 id TEXT PRIMARY KEY NOT NULL,
 account_id TEXT REFERENCES customer_accounts(id) ON DELETE SET NULL,
 product TEXT NOT NULL CHECK (product IN ('pro', 'business', 'enterprise', 'credit', 'offer')),
 billing TEXT NOT NULL CHECK (billing IN ('monthly', 'annual', 'once')),
 reference TEXT,
 email TEXT NOT NULL,
 company TEXT NOT NULL,
 price_minor INTEGER CHECK (price_minor >= 0),
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;
