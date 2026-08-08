# Archive Report: expense-tracker

**Change**: expense-tracker
**Archived on**: 2026-08-08
**Final state**: success — SDD cycle complete (proposed, specified, designed, implemented, verified, archived)
**Artifact mode**: hybrid (OpenSpec file store + Engram)

## Change Summary

Greenfield local-first personal finance tracker: manual expense and income recording with FX-at-entry, hierarchical categories with stable IDs and soft-delete, per-category + global monthly budgets, and month/quarter/year summaries with net flow and savings rate. Modular monolith, hexagonal, 3 layers (pure domain + Express/SQLite adapters + React SPA), npm-workspaces TypeScript monorepo, SQLite with hand-rolled migrations. Money in integer minor units; summaries never convert across currencies; budgets convert via the rate stored at entry.

## What Was Delivered

- **5 capability specs promoted to baseline** (`openspec/specs/`): `expense-tracking`, `income-tracking`, `category-management`, `budget-management`, `period-summaries` (23 requirements, 34 scenarios).
- **Domain core** (`packages/domain`): entities, VOs (Money, Direction, PeriodKey), use cases for transactions, categories, budgets, summaries; ports (repositories, Clock); domain errors. 104 unit tests.
- **API** (`apps/api`): Express REST `/api/v1` (transactions, categories tree, budgets, summaries), SQLite repositories, error envelope `{error:{code,message,details[]}}`, migration runner wiring. 48 integration tests.
- **Web** (`apps/web`): React SPA — Transactions, Categories, Budgets, Summaries pages; `useApi` hook; tabs navigation. 14 component tests.
- **Database** (`db/migrations/`): `001_schema.sql` (categories, transactions, budgets), `002_seed_categories.sql` (10 default categories, stable IDs 1–10); `scripts/migrate.ts` runner with WAL + busy_timeout pragmas.
- **Verified totals**: 166/166 tests green (domain 104, api 48, web 14), typecheck clean (0 errors), E2E smoke 9/9, 14/14 live spot-checks.

## Verification Verdict

**PASS-WITH-WARNINGS** at close, per final-state facts (outrank intermediate snapshots):

- 23/23 requirements verified, 34/34 scenarios compliant, validated by gentle-ai sdd-verify-validate (requirements 23, scenarios 34).
- 166/166 tests green, typecheck clean, E2E smoke 9/9.
- No CRITICAL findings, 0 blockers.

Runtime review ledger at close: apply attempt registered `passed` (maintainer-approved scope reset for per-slice budget), verify attempt settled `complete`.

## Accepted Risks

- **W1 — PATCH currency-switch edit silently inherits the previous rate** (user-approved, accepted, NOT remediated): `apps/api/src/http/routes/transactions.ts:101` (`rate: body.rate ?? existing.rate`) cannot distinguish "rate omitted" from "keep existing rate" when the currency changes (e.g., ARS→USD), so the old rate (1) passes the ET-2 "rate > 0" check and the expense is persisted at rate 1. Budget consumption (BM-1) then converts 1 USD = 1 ARS, undervaluing consumption. Scope: direct API clients only — the web form is create-only and always sends a rate for USD. Engram discovery `#35` (obs-0e78edc9bd03f69a).
- Non-blocking suggestions recorded at verify time (not spec violations): missing `GET /transactions/:id` (consistent with design's API table), BM-1 scenario arithmetic typo (5000 USD × 950 = 4,750,000; intended example is 50 USD × 950 = 47,500 — implementation correct per requirement text).

## Delivery State

- Implementation complete on **local branch `feature/expense-tracker`** (tip `d134051`; verified 56 commits on the branch; final-state facts recorded 55 — tip hash matches, minor count discrepancy from an intermediate count).
- 16 slice branches merged into the feature branch (`slice/s2a`..`slice/s8c`); every slice diff ≤ 400 authored lines (generated package-lock.json excluded).
- **No remote configured, no PRs created.** Delivery as chained PRs (feature-branch-chain: PR #1 base = `feature/expense-tracker`, PR #N base = PR #N−1 branch) is pending creation of a GitHub remote — user decision deferred.
- `apply-progress.md` (per Engram `#33`, 2026-08-08 18:47) is an intermediate snapshot; `verify-report.md` (per Engram `#34`, 2026-08-08 18:58) is an intermediate snapshot. Where they differ from the final-state facts above, the final-state facts win (Final-State Authority).

## Task Completion

All 34/34 task checkboxes in `tasks.md` are marked `[x]` (Task Completion Gate passed; no stale unchecked implementation tasks; no archive-time reconciliation was needed).

## Next Steps (project)

1. **Create a GitHub remote** for `finanzas-personales` (user decision deferred) and push `feature/expense-tracker` + the 16 slice branches.
2. **Open the chained PRs** per the feature-branch-chain strategy (PR #1 base = feature branch, child PRs retarget to the previous slice branch until diffs are clean).
3. **Decide W1 remediation**: add explicit rate-required semantics on currency-switch edits (reject missing rate when currency changes) or keep the documented behavior — track as a follow-up issue if accepted as-is.
4. **Deploy** when desired: small VPS or PaaS with persistent disk (Fly.io/Render); SQLite stays (WAL + busy_timeout, backup = file copy); NOT ephemeral serverless. PostgreSQL migration path exists via adapter swap through domain ports.
5. **Start the next change**: SDD cycle is complete and ready.

## Traceability — Engram Observations (project: finanzas-personales)

| Artifact | Observation ID |
|---|---|
| explore | `#28` (obs-054e3d70c9fac109) |
| proposal | `#29` (obs-50f122fa1ffab351) |
| spec | `#30` (obs-4356a27bf0c54a3a) |
| design | `#31` (obs-d268943d71d7f2ea) |
| tasks | `#32` (obs-66228388a01d93df) |
| apply-progress | `#33` (obs-aca6f0fdf38358d9) |
| verify-report | `#34` (obs-28e24a7fac8ca5e7) |
| W1 discovery | `#35` (obs-0e78edc9bd03f69a) |
| **archive-report** | **this document** (topic key `sdd/expense-tracker/archive-report`) |

## Archived Artifacts

- `openspec/changes/archive/2026-08-08-expense-tracker/proposal.md`
- `openspec/changes/archive/2026-08-08-expense-tracker/specs/` (5 capability specs)
- `openspec/changes/archive/2026-08-08-expense-tracker/design.md`
- `openspec/changes/archive/2026-08-08-expense-tracker/tasks.md` (34/34 `[x]`)
- `openspec/changes/archive/2026-08-08-expense-tracker/apply-progress.md`
- `openspec/changes/archive/2026-08-08-expense-tracker/verify-report.md`
- `openspec/changes/archive/2026-08-08-expense-tracker/archive-report.md` (this document)
