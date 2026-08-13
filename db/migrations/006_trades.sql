-- Trade ledger (capability: trade-history).
-- trades: the source of truth for portfolio positions (TH-1..TH-5). Derived
-- positions and realized P&L are computed by the domain from these rows; the
-- positions table stays only as a rollback net (PI-1).
-- quantity is REAL so fractional CEDEARs are allowed; price_minor is USD
-- cents; trade_date is a YYYY-MM-DD calendar date; created_at is a UTC ISO
-- instant. Same-date rows are ordered deterministically by id (TH-2, D7).
--
-- Seed (TH-5): every legacy position becomes an initial BUY trade at its
-- avg_cost_minor, dated today, currency USD. Seed rows are ordinary rows —
-- editable through the normal CRUD. The migration runner's schema_migrations
-- bookkeeping makes the seed run exactly once.

CREATE TABLE trades (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker      TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  trade_date  TEXT NOT NULL,
  quantity    REAL NOT NULL CHECK (quantity > 0),
  price_minor INTEGER NOT NULL CHECK (price_minor > 0),
  currency    TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_trades_ticker_date ON trades (ticker, trade_date, id);

INSERT INTO trades (ticker, type, trade_date, quantity, price_minor, currency, created_at)
SELECT ticker, 'buy', date('now'), quantity, avg_cost_minor, 'USD', datetime('now')
FROM positions;
