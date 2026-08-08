-- Expense Tracker schema v1
-- Money is stored in integer minor units; rates are REAL and captured at entry.
-- ARS is the base currency: ARS transactions always carry rate 1.
-- schema_migrations is managed by the migration runner (scripts/migrate.ts).

CREATE TABLE categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  parent_id  INTEGER NULL REFERENCES categories(id),
  deleted_at TEXT    NULL
);

CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  direction    TEXT    NOT NULL CHECK (direction IN ('expense', 'income')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency     TEXT    NOT NULL CHECK (currency IN ('ARS', 'USD')),
  rate         REAL    NOT NULL CHECK (rate > 0),
  tx_date      TEXT    NOT NULL,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  note         TEXT    NULL
);

CREATE INDEX idx_transactions_date ON transactions(tx_date);
CREATE INDEX idx_transactions_category ON transactions(category_id);

CREATE TABLE budgets (
  category_id INTEGER PRIMARY KEY REFERENCES categories(id),
  cap_minor   INTEGER NOT NULL CHECK (cap_minor > 0)
);
