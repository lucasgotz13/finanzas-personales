# Design: Expense Tracker

## Technical Approach

Modular monolith, hexagonal, 3 layers (locked): pure domain + adapters (Express, SQLite). npm-workspaces TS monorepo; React SPA consumes REST; SQLite with hand-rolled migrations. FX captured at entry (ET-1); summaries never convert (PS-4); budgets convert via stored rate (BM-1). Testing: domain unit + API integration + light component.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Monorepo | npm workspaces + strict TS + Vitest (tsx/Vite) | pnpm/nx | Built-in, no extra tooling |
| Layers | domain ← adapters; web consumer | 4+ layers | Locked constraint; swappable |
| Category tree | Adjacency list, ancestor walk on move | Closure table | Depth ≤ 3; O(depth) cycle check |
| Migrations | SQL-file runner | Knex/Prisma | ~4 files; no ORM |
| Web state | Plain hooks + `useApi`, tabs | Zustand/Redux/router | Per-view data; no shared state |
| Money | INTEGER minor units, rate REAL, round once | Decimal lib | Safe ints; rates never in summaries |

## Repository Layout (all files Create)

```
finanzas-personales/
├── package.json, tsconfig.base.json   # workspaces: packages/*, apps/*
├── db/migrations/                     # 001_schema.sql, 002_seed_categories.sql
├── packages/domain/                   # entities, VOs, use-cases, ports, tests
├── apps/api/                          # http (routes/errors), sqlite (repos, migrate), tests
└── apps/web/                          # pages, components, api.ts
```

## Domain Core (pure, no framework imports)

- Entities: `Transaction{id, direction, amountMinor, currency, rate, txDate, categoryId, note}`, `Category{id, name, parentId, deletedAt}`, `Budget{categoryId, capMinor}`.
- VOs: `Money(amountMinor, currency, rate)`, `PeriodKey`, `Direction`.
- Use cases: transaction CRUD (ET-1..6, IT-1..2); category CRUD + tree (CM-1..5); budgets + status (BM-1..4); summaries (PS-1..5).
- Ports: Transaction/Category/Budget repositories; `Clock` (AR tz).

## SQLite Schema

| Table | Columns / constraints |
|---|---|
| categories | `id` PK AUTOINCREMENT; `name` NOT NULL; `parent_id` NULL REFERENCES categories(id); `deleted_at` NULL; INDEX(parent_id) |
| transactions | `id` PK; `direction` CHECK(expense\|income); `amount_minor` INTEGER CHECK(>0); `currency` CHECK(ARS\|USD); `rate` REAL CHECK(>0); `tx_date` TEXT; `category_id` REFERENCES categories(id); `note` NULL; INDEX(tx_date), INDEX(category_id) |
| budgets | `category_id` PK REFERENCES categories(id); `cap_minor` INTEGER CHECK(>0) |
| schema_migrations | `version` PK; `applied_at` |

Soft-delete = `deleted_at` (CM-4); rows stay joinable for history (PS-5). Cycle/children checks in domain. Period queries: `tx_date BETWEEN AR-tz range`; no denormalized column.

## API Design (REST, `/api/v1`)

| Method/Path | Request → Response |
|---|---|
| POST /transactions | `{direction, amountMinor, currency, rate?, date, categoryId, note?}` → 201; 422 (amount ≤ 0, bad currency, rate missing/≤ 0 non-ARS, deleted category); 404 |
| GET /transactions | `?month=` or `from/to`, `categoryId`, `direction` → array |
| PATCH · DELETE /transactions/:id | 200 / 204; re-validates (ET-5) |
| GET /categories/tree · POST /categories | tree (deleted hidden) → 201 |
| PATCH /categories/:id · DELETE | 200 / 204; 409 on delete-with-children, cycle, own-subtree move |
| GET · PUT /budgets | `{categoryId: capMinor}` map; PUT replaces all (BM-3) |
| GET /budgets/status?month= | per cat `{cap, consumed, overBudget}` + global; uncapped excluded (BM-2) |
| GET /summaries?period=month\|quarter\|year&date= | per currency `{expense, income, netFlow, savingsRate\|null}`; per-category totals; deleted under current name (PS-5) |

Errors: `{error: {code, message, details[]}}` — VALIDATION_ERROR 422, NOT_FOUND 404, CONFLICT 409. Rate required iff currency ≠ ARS (domain-validated).

## Web App

Pages: Transactions (list + modal form), Categories (tree editor), Budgets (editor + status), Summaries (period picker). Components: `TransactionForm`, `TransactionList`, `CategoryTree`, `BudgetEditor`, `SummaryView`; `useApi` hook; tabs (D5).

## Data Flow

```
SPA ──fetch──▶ Express routes ──▶ use cases (domain)
                              │      │
                              └──────┘ ports → SQLite repos
```

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | validation, backdating, budget conversion, savings-rate undefined, cycles, soft-delete | Vitest, pure domain |
| Integration | endpoint shapes, error codes, seed | Vitest + supertest, temp SQLite |
| Component | form validation UI, budget status, summary render | Vitest + RTL, light |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR, executable, or process-integration boundary (loopback REST, single user). All five matrix rows N/A.

## Migration / Rollout

Greenfield. `npm run migrate` creates `finanzas.db` + schema + seed IDs 1–10 (CM-2). Rollback: delete DB file, drop branch.

## Deployment Note

Single-user app intended for later deployment and access from multiple devices. **SQLite remains the storage choice**: multi-device access is solved by the deployed backend (SPA reached from any browser), not by the database.

- Hosting: persistent filesystem required (small VPS or PaaS with attached disk, e.g. Fly.io/Render). NOT ephemeral serverless.
- SQLite pragmas at runtime: `journal_mode=WAL` + `busy_timeout` (read concurrency, single writer — matches one user).
- Backup = file copy (`sqlite3 finanzas.db .backup`).
- Migration path to PostgreSQL: adapter swap through domain ports (hexagonal, D2) when multi-user write concurrency becomes real; domain untouched.

## Work-Unit Sketch (≤ 400 lines each)

| WU | Content | Delivery |
|---|---|---|
| 1 | Scaffold: workspaces, tooling, migration runner, schema, seed | chain base |
| 2 | Domain: entities/VOs/ports + transaction & category use cases + unit tests | PR #2 |
| 3 | API: SQLite repos + Express routes (transactions, categories) + integration tests | PR #3 |
| 4 | Domain + API: budgets & summaries (use cases, routes, tests) | PR #4 |
| 5 | Web: transactions page (form + list) | PR #5 |
| 6 | Web: categories, budgets, summaries pages | PR #6 |

## Open Questions

None blocking. Currencies are a domain constant in v1.
