# Apply Progress: expense-tracker

Status: **complete** — all 8 slices implemented, all 34 tasks marked `[x]` in tasks.md, full suite green, E2E smoke passed.

Mode: Standard (strict_tdd: false). Delivery: chained PRs (feature-branch-chain), LOCAL branches only (no remote configured; no GitHub PRs created).

## Slices Completed

### S1 — Foundation (tasks 1.1–1.4) — branch `feature/expense-tracker` (base)
Commits: `4918a9b` (bootstrap workspaces + strict TS), `d1cc7b1` (schema migration), `7e84baa` (migration runner + README)
Verification:
- `npm run typecheck` → PASS (workspace loop, no errors)
- `npm run migrate` ×2 → PASS (run 1: applied 001_schema + 002_seed_categories; run 2: no-op)
- Seed check: 10 categories with stable IDs 1–10 (CM-2) ✓

### S2 — Domain core: VOs + entities (tasks 2.1–2.4) — branches `slice/s2a` (365 lines), `slice/s2b` (333 lines)
s2a commits: `5f77b8c` (RED VO tests + scaffold), `a9c0cf8` (GREEN Money/Direction/PeriodKey), `14d4d13` (lockfile)
s2b commits: `2b480f8` (RED entity tests), `4951d99` (GREEN entities + errors + ports)
Merges: `06f0ca2` (s2a), `194799c` (s2b)
Verification: `npm test -w packages/domain` → PASS 26/26 (after s2a), 46/46 (after s2b); typecheck PASS

### S3 — Domain: transaction + category use cases (tasks 2.5–2.8) — `slice/s3a` (395 lines), `slice/s3b` (270 lines)
s3a commits: `b9caab8` (RED tx use-case tests), `e246898` (GREEN TransactionService)
s3b commits: `866ed11`→`2b480f8` (RED category tests), `a89989f` (GREEN CategoryService)
Merges: `e262afd` (s3a), `1907194` (s3b)
Verification: `npm test -w packages/domain` → PASS 62/62, then 81/81; typecheck PASS

### S4 — API scaffold + SQLite repos (task 3.1) — `slice/s4` (191 lines)
Commit: `81e56f8`
Verification: `npm run typecheck` PASS; fresh `FINANZAS_DB=temp npm run migrate` ×2 PASS; runtime smoke (tsx) — CRUD + AR-tz month filters on real SQLite PASS

### S5 — Routes + integration tests + bootstrap (tasks 3.2–3.6) — `slice/s5a` (370 lines), `slice/s5b` (265 lines)
s5a commits: `4f00d97` (RED tx integration tests), `f10e9fe` (GREEN tx routes + error middleware + app shell)
s5b commits: `2b480f8`→`866ed11` (RED category integration tests), `fe3e617` (GREEN categories routes + tree builder + bootstrap)
Merges: `a4d2708` (s5a), `6df0fef` (s5b)
Verification: `npm test -w apps/api` → PASS 15/15, then 30/30; curl smoke against booted server (POST/PATCH/DELETE/422/409) PASS

### S6 — Budgets + summaries (tasks 4.1–4.7) — `slice/s6a` (234), `slice/s6b` (233), `slice/s6c` (328)
s6a commits: RED budget tests + GREEN BudgetService (merged `9ac76c2`)
s6b commits: RED summary tests + GREEN SummaryService (merged `ef32c5a`)
s6c commits: RED integration tests + GREEN budget/summary routes + SqliteBudgetRepository (merged `1a05f43`)
Verification: `npm test -w packages/domain` → 104/104; `npm test -w apps/api` → 48/48; typecheck PASS

### S7 — Web transactions page (tasks 5.1–5.4) — `slice/s7a` (394), `slice/s7b` (378), `slice/s7c` (105)
s7a commit: `12f8415` (scaffold + api.ts + useApi) — `npm run build -w apps/web` PASS (merged `c37cff3`)
s7b commits: RED RTL tests + TransactionForm/TransactionList (merged `b7ff105`)
s7c commit: TransactionsPage + tabs wiring (merged `6d1f7c0`)
Verification: `npm test -w apps/web` → 9/9 (after s7c); build PASS

### S8 — Web remaining pages (tasks 6.1–6.4) — `slice/s8a` (181), `slice/s8b` (257), `slice/s8c` (129)
s8a: CategoryTree + CategoriesPage (merged `9f7352f`)
s8b: BudgetEditor + BudgetsPage + tests (merged `ed72842`)
s8c: SummaryView + SummariesPage + tabs + README (merged `e699e10`)
Verification: `npm test -w apps/web` → 14/14; build PASS

### 7.1 — Final verification — commit `91cbc92` (marks), `1cc417c` (phase 3 marks)
- Full suite: `npm test` → domain 104/104, api 48/48, web 14/14 — ALL PASS
- `npm run typecheck` → PASS (0 errors)
- E2E smoke (fresh DB → migrate → API + vite dev → record expense through vite proxy → budget/summary reflect): ALL PASS — 9/9 checks including BM-1 converted consumption (52500 ARS from 5000 ARS + 50 USD × 950), PS/IT savings rate 0.994, PS-4 per-currency separation, ET-5 delete reflected.

## Branch List (local chain, feature-branch-chain)

main → feature/expense-tracker (S1 base, no remote, no PRs created)
- feature/expense-tracker @ 1cc417c (aggregates all slices via merges)
- slice/s2a, slice/s2b ← S2
- slice/s3a, slice/s3b ← S3
- slice/s4 ← S4
- slice/s5a, slice/s5b ← S5
- slice/s6a, slice/s6b, slice/s6c ← S6
- slice/s7a, slice/s7b, slice/s7c ← S7
- slice/s8a, slice/s8b, slice/s8c ← S8

## Deviations / Notes

- schema_migrations table is created by the migration runner (scripts/migrate.ts), not declared in 001_schema.sql, to avoid a double-create; the resulting schema matches the design.
- API field is `date` (design API contract) mapped to domain `txDate`; responses serialize `date`.
- Package-lock.json committed (generated, excluded from line budgets).
- Slice splitting: S2, S3, S5, S6, S7, S8 exceeded 400 authored lines in implementation, so each was delivered as multiple chain branches (2a/2b, 3a/3b, 5a/5b, 6a/6b/6c, 7a/7b/7c, 8a/8b/8c); every branch diff ≤ 400 lines (excluding generated lockfile).
- Bug found during S7: domain typecheck had silently failed since S6a (`tx.currency` string→Currency, test fixtures missing `note`) — fixed in commit on s7b, verified 0 errors since.
- E2E harness: vite root must be apps/web (root is cwd-based, not config-based); `vite --root` is not a valid CLI flag (root is positional).
- Browser-level native validation (min="1") blocks submit before JS validation — form uses noValidate and its own messages.

## Remaining / Blocked

None. All 34/34 tasks complete. No blockers.

## Next

Ready for sdd-verify.
