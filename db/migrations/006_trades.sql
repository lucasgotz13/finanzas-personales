-- Trade ledger (capability: trade-history).
-- trades: the source of truth for portfolio positions (TH-1..TH-5). Derived
-- positions and realized P&L are computed by the domain from these rows; the
-- positions table stays only as a rollback net (PI-1).
-- quantity is REAL so fractional CEDEARs are allowed; price_minor is USD
-- cents; trade_date is a YYYY-MM-DD calendar date; created_at is a UTC ISO
-- instant. Same-date rows are ordered deterministically by id (TH-2, D7).
-- price_snapshots loses its FK to positions: snapshots now key on derived
-- tickers, which may have no legacy positions row (PI-3).
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

-- Positions are now derived from trades, so tickers bought after this
-- migration have no positions row. The old FK would reject their price
-- snapshots; rebuild the table without it (no mutations touch positions
-- anymore, so the delete-cascade had no remaining caller).
CREATE TABLE price_snapshots_new (
  ticker      TEXT PRIMARY KEY,
  price_minor INTEGER NOT NULL,
  currency    TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  source      TEXT NOT NULL
);

INSERT INTO price_snapshots_new SELECT ticker, price_minor, currency, fetched_at, source FROM price_snapshots;

DROP TABLE price_snapshots;
ALTER TABLE price_snapshots_new RENAME TO price_snapshots;
