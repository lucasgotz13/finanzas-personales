-- Price chart series cache (capability: price-charts).
-- One row per (ticker, range) series plus CCL rows keyed (ccl, range) (PC-4).
-- Daily TTL (~24 h) is enforced by the domain (SERIES_TTL_MS) — NOT the
-- 5-min snapshot TTL. Reads are cache-first; force=true refreshes; a failed
-- refresh keeps the last cached row (served stale). points_json holds
-- [{date, valueMinor}] for series rows and REAL [{date, value}] for CCL rows
-- (D8). CCL rows store 'ARS' in native_currency (the rate is ARS per USD).

CREATE TABLE series_cache (
  key             TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('series', 'ccl')),
  native_currency TEXT NOT NULL CHECK (native_currency IN ('ARS', 'USD')),
  points_json     TEXT NOT NULL,
  fetched_at      TEXT NOT NULL
);
