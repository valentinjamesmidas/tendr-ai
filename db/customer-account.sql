CREATE TABLE IF NOT EXISTS customer_accounts (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT UNIQUE NOT NULL,
 email_verified_at INTEGER,
 password_salt TEXT NOT NULL CHECK (length(password_salt) = 32),
 password_hash TEXT NOT NULL CHECK (length(password_hash) = 64),
 credits INTEGER NOT NULL DEFAULT 1 CHECK (credits >= 0),
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;

CREATE TABLE IF NOT EXISTS customer_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
 account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS customer_sessions_expires_at ON customer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS customer_credit_reservations (
 id TEXT PRIMARY KEY NOT NULL,
 account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('reserved', 'consumed')) DEFAULT 'reserved'
) STRICT;

CREATE INDEX IF NOT EXISTS customer_credit_reservations_active
 ON customer_credit_reservations(account_id, status, expires_at);

CREATE TRIGGER IF NOT EXISTS customer_credit_reservations_debit
 AFTER UPDATE OF status ON customer_credit_reservations
 WHEN OLD.status = 'reserved' AND NEW.status = 'consumed'
 BEGIN
  UPDATE customer_accounts SET credits = credits - 1 WHERE id = NEW.account_id;
 END;
