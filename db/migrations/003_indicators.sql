-- Argentina economic indicators snapshot cache (capability: economic-indicators).
-- Values are REAL (decimal rates, %, millions USD); fetched_at is a UTC ISO
-- instant. key is the stable indicator key (usd-blue, ...) from the domain
-- catalog. The upsert lives in SqliteIndicatorCache; this migration only
-- creates the table.

CREATE TABLE indicator_snapshots (
  key            TEXT PRIMARY KEY,
  value          REAL NOT NULL,
  unit           TEXT NOT NULL,
  reference_date TEXT NOT NULL,
  fetched_at     TEXT NOT NULL,
  source         TEXT NOT NULL
);
