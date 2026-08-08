# Tasks: Expense Tracker

## Review Workload Forecast
Estimated changed lines: ~2,800–3,000 (S1 350 · S2 380 · S3 350 · S4 300 · S5 350 · S6 420 · S7 400 · S8 420)
400-line budget risk: Medium — S6/S8 near limit; split child PRs if diff > 400
Chained PRs recommended: Yes — S1 chain base, S2..S8 stack on it
Delivery strategy: ask-on-risk — chain strategy pending (recommend feature-branch-chain: PR #1 base = feature/expense-tracker, PR #N base = PR #(N−1) branch; alt. stacked-to-main)

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| S1 | WU1 scaffold: workspaces, TS, migrations, seed | PR #1 (base) | `npm run typecheck`; `npm run migrate` ×2 | migrate → finanzas.db, 10 cats | delete db/, revert commit |
| S2 | WU2a domain core + tests | PR #2 | `npm test -w packages/domain` | N/A (pure domain) | rm packages/domain |
| S3 | WU2b tx+category use cases + tests | PR #3 | `npm test -w packages/domain` | N/A (pure domain) | rm use-case files |
| S4 | WU3a api scaffold + SQLite repos | PR #4 | `npm run typecheck -w apps/api`; fresh migrate | supertest, temp SQLite | rm repos |
| S5 | WU3b routes + errors + integration tests | PR #5 | `npm test -w apps/api` | curl dev server | rm routes |
| S6 | WU4 budgets+summaries domain+API (4a/4b if >400) | PR #6 | `npm test -w packages/domain && npm test -w apps/api` | curl /summaries, /budgets/status | rm budget/summary units |
| S7 | WU5 web transactions page | PR #7 | `npm test -w apps/web` | dev: migrate→api→web; record expense | rm apps/web |
| S8 | WU6 web remaining pages (split if >400) | PR #8 | `npm test -w apps/web` | dev smoke, full flow | rm remaining pages |

## Phase 1: Foundation (S1)
- [x] 1.1 Root package.json (workspaces) + tsconfig.base.json (strict) + .gitignore — install + tsc base
- [x] 1.2 db/migrations/001_schema.sql: categories, transactions, budgets, schema_migrations; CHECK/INDEX (ET-2, CM-2, BM-1, PS-1)
- [x] 1.3 db/migrations/002_seed_categories.sql: IDs 1–10 (CM-2) — migrate: 10 rows
- [x] 1.4 scripts/migrate.ts + `npm run migrate` + WAL/busy_timeout pragmas + root README — migrate ×2 idempotent

## Phase 2: Domain Core (S2+S3)
- [x] 2.1 RED packages/domain scaffold + failing VO tests Money/Direction/PeriodKey (ET-1, IT-1, PS-1)
- [x] 2.2 GREEN VOs Money(amountMinor,currency,rate), Direction, PeriodKey AR-tz bounds (ET-1, PS-1)
- [x] 2.3 RED entity tests: amount>0, currency, rate iff non-ARS, no self-ancestor, cap>0 (ET-2, IT-2, CM-1, BM-1)
- [x] 2.4 GREEN entities + errors VALIDATION_ERROR/NOT_FOUND/CONFLICT + ports repos/Clock (ET-2, CM-1)
- [x] 2.5 RED tx use-case tests: FX entry, backdate, re-validate, delete, dupes, income (ET-1/3/5/6, IT-1/2)
- [x] 2.6 GREEN tx use cases create/list/update/delete (ET-1..6, IT-1/2)
- [x] 2.7 RED category tests: cycles, move, soft-delete w/ children, rename keeps ID (CM-1/3/4/5)
- [x] 2.8 GREEN category use cases (CM-1/3/4/5)

## Phase 3: API Adapters (S4+S5)
- [ ] 3.1 apps/api scaffold (vitest+supertest) + SqliteTransaction/CategoryRepository (ET-1, CM-3) — typecheck
- [ ] 3.2 RED integration: POST /transactions 201/422 (amount, currency, rate, deleted cat), GET filters, PATCH/DELETE (ET-1/2/5, IT-2, CM-4)
- [ ] 3.3 GREEN routes + error middleware (ET-1..6, IT-1/2) — `npm test -w apps/api`
- [ ] 3.4 RED integration: categories tree/POST/PATCH 409 cycle+move/DELETE w/ children (CM-1..5)
- [ ] 3.5 GREEN /categories routes + tree builder (CM-1..5)
- [ ] 3.6 src/index.ts bootstrap + pragmas + listen — curl smoke

## Phase 4: Budgets & Summaries (S6)
- [ ] 4.1 RED budget tests: rate conversion, month attribution, global cap, over-budget, re-adjust (BM-1..4)
- [ ] 4.2 GREEN budget use cases (BM-1..4)
- [ ] 4.3 RED summary tests: AR-tz periods, per-currency, net flow, savings undefined, deleted cats (PS-1..5, IT-3)
- [ ] 4.4 GREEN summary use cases (PS-1..5, IT-3)
- [ ] 4.5 SqliteBudgetRepository + summary queries (BM-1, PS-1) — typecheck
- [ ] 4.6 RED integration: PUT/GET /budgets, /budgets/status, /summaries (BM-1..4, PS-1..5)
- [ ] 4.7 GREEN budget+summary routes (BM-1..4, PS-1..5) — `npm test -w apps/api`

## Phase 5: Web Transactions (S7)
- [ ] 5.1 apps/web scaffold (Vite+React+TS) + api.ts + useApi hook (D5) — `npm run build -w apps/web`
- [ ] 5.2 TransactionForm: amount, currency, rate-if-USD, date, category (deleted hidden), note (ET-1/2, IT-1)
- [ ] 5.3 TransactionList + tabs + Transactions page (ET-1..6, IT-1)
- [ ] 5.4 RTL tests: form validation, list render (ET-2) — `npm test -w apps/web`

## Phase 6: Web Remaining (S8)
- [ ] 6.1 CategoryTree + Categories page: add/rename/delete w/ children guard (CM-1..5)
- [ ] 6.2 BudgetEditor + Budgets page + over-budget status (BM-1..4)
- [ ] 6.3 SummaryView + Summaries page period picker (PS-1..5, IT-3)
- [ ] 6.4 Tabs navigation + README run docs (D5) — manual check

## Phase 7: Verification
- [ ] 7.1 Full `npm test` across workspaces + fresh smoke: migrate → dev → record expense → budget/summary reflect (ET-1..6, IT-1..3, CM-1..5, BM-1..4, PS-1..5)

Threat matrix: all rows N/A (design) — no threat RED tasks.
