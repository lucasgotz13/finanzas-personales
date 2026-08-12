-- Investment tracking (capability: investment-tracking).
-- positions: manual-entry portfolio rows (CEDEARs & BYMA stocks, USD-native).
-- quantity is REAL so fractional CEDEARs are allowed; avg_cost_minor is the
-- average cost basis in USD cents; created_at is a UTC ISO instant.
-- price_snapshots: one row per ticker, upserted by SqlitePriceCache; the FK
-- removes snapshots when the position is hard-deleted (PI-1, PI-3). The
-- foreign_keys pragma is already ON in scripts/migrate.ts.

CREATE TABLE positions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker         TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  quantity       REAL NOT NULL CHECK (quantity > 0),
  avg_cost_minor INTEGER NOT NULL CHECK (avg_cost_minor > 0),
  created_at     TEXT NOT NULL
);

CREATE TABLE price_snapshots (
  ticker      TEXT PRIMARY KEY REFERENCES positions(ticker) ON DELETE CASCADE,
  price_minor INTEGER NOT NULL,
  currency    TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  source      TEXT NOT NULL
);
