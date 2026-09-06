-- Savings goals ("Metas de ahorro").
-- goals: one row per goal (name + target + currency + optional deadline).
-- created_at is a UTC ISO instant set automatically; the automatic surplus
-- window starts at that instant, so historical surplus never counts.
-- priority is a dense 0..n-1 rank: lower fills first from the per-currency
-- surplus waterfall; the API renumbers it on delete/reorder.
-- goal_adjustments: signed manual movements (positive = aporte, negative =
-- retiro) in the goal's currency. Progress is always derived from these rows
-- plus the automatic surplus, never stored, so it cannot be overwritten.
-- Deleting a goal removes its adjustments (FK cascade; the repository also
-- deletes them explicitly first so the invariant holds with FKs off).

CREATE TABLE goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  target_minor INTEGER NOT NULL CHECK (target_minor > 0),
  currency     TEXT    NOT NULL CHECK (currency IN ('ARS', 'USD')),
  deadline     TEXT    NULL,
  created_at   TEXT    NOT NULL,
  priority     INTEGER NOT NULL CHECK (priority >= 0)
);

CREATE INDEX idx_goals_priority ON goals(priority, created_at, id);

CREATE TABLE goal_adjustments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id      INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor != 0),
  created_at   TEXT    NOT NULL
);

CREATE INDEX idx_goal_adjustments_goal ON goal_adjustments(goal_id);
