-- Seed default categories with stable IDs 1-10 (CM-2).
-- IDs are explicit so renames never break transaction history (CM-3).

INSERT INTO categories (id, name, parent_id, deleted_at) VALUES
  (1,  'Food',          NULL, NULL),
  (2,  'Transport',     NULL, NULL),
  (3,  'Housing',       NULL, NULL),
  (4,  'Utilities',     NULL, NULL),
  (5,  'Health',        NULL, NULL),
  (6,  'Entertainment', NULL, NULL),
  (7,  'Education',     NULL, NULL),
  (8,  'Savings',       NULL, NULL),
  (9,  'Other',         NULL, NULL),
  (10, 'Salary',        NULL, NULL);
