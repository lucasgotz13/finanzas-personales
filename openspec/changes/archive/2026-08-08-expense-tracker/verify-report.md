```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b43b77809e46a81cbbc76c5173188a962cf6c2890908edfb75b9ed96e0034620
verdict: pass
blockers: 0
critical_findings: 0
requirements: 23/23
scenarios: 34/34
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:b43b77809e46a81cbbc76c5173188a962cf6c2890908edfb75b9ed96e0034620
build_command: npm run typecheck
build_exit_code: 0
build_output_hash: sha256:6497e57060d356229e6aa7b63d6ff836058b986528a49a73e6eb6b9d2b0f58af
```

# Verification Report: expense-tracker

**Change**: expense-tracker
**Version**: N/A (first implementation)
**Mode**: Standard (strict_tdd: false) — full artifacts (proposal, specs, design, tasks, apply-progress)

**Branch**: feature/expense-tracker @ d134051
**Verification date**: 2026-08-08
**Environment**: Linux, Node v25.0.0, npm workspaces, Vitest 3.2.7, tsx; fresh temp SQLite DB for live checks

## Status Summary

**PASS-WITH-WARNINGS** — All 166 tests pass on independent re-run, typecheck is clean, all 23 requirements verified against code + runtime evidence, and all 5 behavioral spot-checks pass live against a booted API with a fresh database. One WARNING: the API PATCH merge cannot distinguish "rate not provided" from "keep existing rate" when the currency changes, so a currency-switch edit can silently inherit the previous entry's rate. Two SUGGESTIONs noted (no spec violation).

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 34 |
| Tasks complete | 34 |
| Tasks incomplete | 0 |

## Build & Tests Execution

**Build (typecheck)**: ✅ Passed — exit 0, 0 errors (`npm run typecheck` across workspaces domain/api/web)

**Tests**: ✅ 166 passed / ❌ 0 failed / 0 skipped — `npm test` from repo root
- `packages/domain`: 104/104 (10 files)
- `apps/api`: 48/48 (3 files)
- `apps/web`: 14/14 (6 files)
- Output hash: `sha256:b43b77809e46a81cbbc76c5173188a962cf6c2890908edfb75b9ed96e0034620`

**Coverage**: ➖ Not configured (no threshold in project)

## Spec Compliance Matrix (34/34 scenarios compliant)

| Requirement | Scenario | Covering test | Result |
|-------------|----------|---------------|--------|
| ET-1 | Happy path registration | `vo/money.test.ts > stores an ARS amount with rate 1`; api `transactions.test.ts:22` | ✅ COMPLIANT |
| ET-1 | Foreign currency with FX at entry | `vo/money.test.ts:13`; `use-cases/transactions.test.ts:46`; api `transactions.test.ts:30`; live check 2 | ✅ COMPLIANT |
| ET-1 | Rate unknown is rejected | `vo/money.test.ts:36`; `use-cases/transactions.test.ts:59`; api `transactions.test.ts:38`; live check 1 | ✅ COMPLIANT |
| ET-2 | Negative amount rejected | `vo/money.test.ts:24`; api `transactions.test.ts:46` | ✅ COMPLIANT |
| ET-2 | Deleted category rejected | `use-cases/transactions.test.ts:116`; live check 11 | ✅ COMPLIANT |
| ET-3 | Backdated expense affects past period | `use-cases/transactions.test.ts:73`; `summaries.test.ts:38`; api `transactions.test.ts:70`; live checks 3, 6 | ✅ COMPLIANT |
| ET-5 | Invalid edit rejected | `use-cases/transactions.test.ts:125`; api `transactions.test.ts:102`; live check 14 | ✅ COMPLIANT |
| ET-5 | Delete removes from summaries | `use-cases/transactions.test.ts:182`; api `transactions.test.ts:132` | ✅ COMPLIANT |
| ET-6 | Duplicate accepted | `use-cases/transactions.test.ts:84`; live check 13 | ✅ COMPLIANT |
| IT-1 | Income registered | `use-cases/transactions.test.ts:92`; api `transactions.test.ts:59`; live check 4 | ✅ COMPLIANT |
| IT-1 | Foreign-currency income | `use-cases/transactions.test.ts:92` (USD path) | ✅ COMPLIANT |
| IT-1 | Rate missing rejected | `use-cases/transactions.test.ts:104`; `vo/money.test.ts:36` | ✅ COMPLIANT |
| IT-2 | Zero income rejected | `use-cases/transactions.test.ts:104` | ✅ COMPLIANT |
| IT-3 | Income feeds savings rate | `summaries.test.ts:96`; live check 7 (0.994) | ✅ COMPLIANT |
| IT-3 | Income in its own currency only | `summaries.test.ts:104`; live check 7 | ✅ COMPLIANT |
| CM-1 | Nested category | `categories.test.ts:32` | ✅ COMPLIANT |
| CM-1 | Cycle rejected | `categories.test.ts:87,93,100` | ✅ COMPLIANT |
| CM-2 | Fresh install has defaults | seed migration `002_seed_categories.sql` (IDs 1-10) + migrate run | ✅ COMPLIANT |
| CM-3 | Rename keeps ID | `categories.test.ts:58` | ✅ COMPLIANT |
| CM-4 | Deleted category keeps history | `summaries.test.ts:130`; live check 10 | ✅ COMPLIANT |
| CM-4 | Deletion with children rejected | `categories.test.ts:134`; live check 12 (409) | ✅ COMPLIANT |
| CM-4 | Deleted category not assignable | `use-cases/transactions.test.ts:116`; live check 11 (422) | ✅ COMPLIANT |
| BM-1 | Foreign expense counts toward cap | `budgets.test.ts:66`; live check 8 (52500) | ✅ COMPLIANT |
| BM-1 | Backdated expense counts toward its month | `budgets.test.ts:76` | ✅ COMPLIANT |
| BM-2 | No budget configured | `budgets.test.ts:87` | ✅ COMPLIANT |
| BM-3 | Cap edited mid-month | `budgets.test.ts:128`; live checks 8-9 | ✅ COMPLIANT |
| BM-4 | Global over-budget | `budgets.test.ts:108`; live check 9 | ✅ COMPLIANT |
| BM-4 | Category over-budget, global OK | `budgets.test.ts:118` | ✅ COMPLIANT |
| PS-1 | Backdated entry appears in past period | `summaries.test.ts:38`; live check 6 | ✅ COMPLIANT |
| PS-1 | Empty period | `summaries.test.ts:47`; live check (zeroed totals, 200) | ✅ COMPLIANT |
| PS-2 | Net flow computed per currency | `summaries.test.ts:77`; live check 7 | ✅ COMPLIANT |
| PS-3 | Zero income | `summaries.test.ts:89`; live checks 6-7 (null) | ✅ COMPLIANT |
| PS-3 | Rate computed | `summaries.test.ts:96`; live check 7 | ✅ COMPLIANT |
| PS-4 | Per-currency totals | `summaries.test.ts:77,119`; live check 7 | ✅ COMPLIANT |

**Compliance summary**: 34/34 scenarios compliant (ET-4, CM-5, PS-5 are requirement-only, no scenarios — verified statically, see traceability).

## Requirement Traceability (23/23)

| Req | Status | Evidence |
|---|---|---|
| ET-1 Expense registration | ✅ verified | `vo/money.ts:36-39` (rate > 0 required non-ARS, ARS normalized to 1); `entities/transaction.ts:34-67`; `use-cases/transactions.ts:28-32`; SQL CHECKs `db/migrations/001_schema.sql:15-21`; tests + live checks 1-2 |
| ET-2 Validation rules | ✅ verified | `entities/transaction.ts:36-57`, `vo/money.ts:30-39`, `use-cases/transactions.ts:60-66`; 422 mapping `http/errors.ts:4-8`; live checks 1, 11, 14 |
| ET-3 Backdating | ✅ verified | `vo/period-key.ts:62-67,82-104`; `sqlite/repositories.ts:87-94`; tests `transactions.test.ts:73`, api `:70`, `summaries.test.ts:38`; live checks 3, 6 |
| ET-4 Notes | ✅ verified | `entities/transaction.ts:52-54,66` (optional, empty allowed); api `transactions.ts:50,67` |
| ET-5 Update and delete | ✅ verified | `use-cases/transactions.ts:34-47` (re-validate via `new Transaction`); api `routes/transactions.ts:93-117`; live check 14 (PATCH amount 0 → 422, original kept) |
| ET-6 Duplicates allowed | ✅ verified | No unique constraint in `001_schema.sql`; test `transactions.test.ts:84`; live check 13 |
| IT-1 Transaction direction | ✅ verified | `vo/direction.ts`; income via same create path; live check 4 |
| IT-2 Income validation | ✅ verified | Same entity/validation path as ET-2; test `transactions.test.ts:104` |
| IT-3 Savings rate inputs | ✅ verified | `use-cases/summaries.ts:70-75`; tests `summaries.test.ts:96,104`; live check 7 |
| CM-1 Hierarchical tree | ✅ verified | `use-cases/categories.ts:32-44` (self-parent + descendant cycle guards); `entities/category.ts:29-31` |
| CM-2 Seeded defaults | ✅ verified | `db/migrations/002_seed_categories.sql` (IDs 1-10, all names); runner `scripts/migrate.ts` |
| CM-3 Stable IDs | ✅ verified | `entities/category.ts` (id immutable); transactions reference `categoryId` (`001_schema.sql:20`); test `categories.test.ts:58` |
| CM-4 Soft-delete | ✅ verified | `use-cases/categories.ts:47-57`, `use-cases/transactions.ts:60-66`; live checks 10, 11, 12 |
| CM-5 Rename | ✅ verified | `use-cases/categories.ts:27-30` (name only, id untouched); test `categories.test.ts:58` |
| BM-1 Per-category monthly cap | ✅ verified | `use-cases/budgets.ts:59-68` (toArsMinor via entry rate, month attribution by tx date); live check 8 (5000 ARS + 50 USD×950 = 52500) |
| BM-2 Global cap | ✅ verified | `use-cases/budgets.ts:70-76` (only configured categories contribute); test `budgets.test.ts:87` |
| BM-3 Manual re-adjustment | ✅ verified | `use-cases/budgets.ts:36-51` (replaceAll, no automation); live checks 8-9 (immediate effect) |
| BM-4 Over-budget status | ✅ verified | `use-cases/budgets.ts:72,80` (computed on read); live check 9 |
| PS-1 Period grouping | ✅ verified | `vo/period-key.ts` (AR-tz, UTC-3); `summaries.ts:46-49`; live check 6 |
| PS-2 Net flow | ✅ verified | `use-cases/summaries.ts:72`; live check 7 (895000 ARS) |
| PS-3 Savings rate | ✅ verified | `use-cases/summaries.ts:73` (null when income 0); live checks 6-7 |
| PS-4 No cross-currency conversion | ✅ verified | `use-cases/summaries.ts:56-75` (raw minor units, no conversion); live check 7 |
| PS-5 Deleted categories remain | ✅ verified | `use-cases/summaries.ts:50-51,77-79` (listAll + current name); live check 10 |

**Traceability counts**: verified 23 · partial 0 · not_verified 0 · failed 0

## Behavioral Spot-Checks (live, booted API + fresh SQLite, 14/14 PASS)

1. **FX-at-entry (ET-1/ET-2)**: POST USD 2500 without rate → 422 VALIDATION_ERROR "rate is required and must be > 0 for non-ARS currencies". USD 50 with rate 950 → 201, `"rate":950` persisted. PASS
2. **Backdating (ET-3, PS-1)**: ARS 600000 dated 2026-07-15 registered during Aug → July summary shows `expense: 600000` under Health. PASS
3. **Soft-delete (CM-4, PS-5)**: DELETE /categories/5 → 204; tree hides Health; July summary still groups 600000 under "Health"; new expense on cat 5 → 422. PASS
4. **Budget consumption (BM-1/BM-2)**: Food cap 100000 → `consumed: 52500` (= 5000 ARS + 50 USD × 950), `overBudget: false`; cap lowered to 40000 → `overBudget: true` (category + global). PASS
5. **Savings rate (PS-3/PS-4)**: July (expenses, no income) → `savingsRate: null`; August (900000 income) → ARS `savingsRate: 0.994`, USD separate with null. PASS

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Monorepo (npm workspaces + strict TS + Vitest) | ✅ Yes | `package.json` workspaces, `tsconfig.base.json` strict |
| Layers: domain ← adapters, web consumer | ✅ Yes | `packages/domain` pure, no framework imports |
| Category tree: adjacency list, ancestor walk | ✅ Yes | `use-cases/categories.ts:84-93` |
| Migrations: SQL-file runner | ✅ Yes | `scripts/migrate.ts`, `db/migrations/` |
| Web state: plain hooks + useApi, tabs | ✅ Yes | `apps/web/src/api.ts`, pages |
| Money: INTEGER minor units, rate REAL, round once | ✅ Yes | `vo/money.ts:49-51` |

API contract matches `design.md:47-60` (incl. `date` field mapping); error envelope `{error:{code,message,details[]}}` matches; schema matches `design.md:36-45`. No deviations found.

## Issues Found

**CRITICAL**: None

**WARNING**:
- **W1 — PATCH currency-switch edit silently inherits the previous rate** (`apps/api/src/http/routes/transactions.ts:101` — `rate: body.rate ?? existing.rate`). Editing an ARS transaction and changing `currency` to USD without a new rate merges the old rate (1), which passes the ET-2 "rate > 0" check, so the expense is persisted as USD at rate 1. Budget consumption (BM-1) then converts 1 USD = 1 ARS. Spec gap: ET-1's "rate recorded at entry" intent is not enforceable on the edit path — the API cannot distinguish "rate omitted" from "keep existing". The web form (`apps/web/src/components/TransactionForm.tsx:32,45`) always sends a rate for USD and is create-only, so the risk is limited to direct API clients.

**SUGGESTION**:
- **S1 — Missing `GET /transactions/:id`** (`apps/api/src/http/routes/transactions.ts` — only POST, GET list, PATCH, DELETE). Live check 14 confirmed 404 "Route not found" for the single-fetch path. Domain `getById` exists (`use-cases/transactions.ts:49-53`) but no public read-by-id endpoint. Consistent with the design's API table, so not a deviation. Low impact for current consumers.
- **S2 — Spec scenario arithmetic typo in BM-1** (`specs/budget-management/spec.md:15` — "USD 5000 expense at entry rate 950 … consumption is 47500 of 100000"). 5000 × 950 = 4,750,000, not 47,500; the intended example is 50 USD × 950 = 47,500 (as exercised by the apply E2E and live check 8). Implementation is mathematically correct per the requirement text; only the scenario numbers are inconsistent.

## Verdict

**PASS WITH WARNINGS** — 166/166 tests pass, typecheck clean, 23/23 requirements and 34/34 scenarios verified with runtime evidence, 14/14 live spot-checks pass. W1 is a non-blocking API-contract edge case; no CRITICAL findings.

## Notes

- Independent re-run confirms apply-progress claims (166 green, typecheck clean, E2E spot-checks reproducible).
- `schema_migrations` created by `scripts/migrate.ts:32` (not in 001_schema.sql) — documented deviation, harmless.
- ExperimentalWarning "SQLite is an experimental feature" from node:sqlite (Node 25) — expected, non-blocking.

## Next

`sdd-archive` is recommended once the W1 decision (add explicit rate-required semantics on currency-switch edits, or accept documented behavior) is resolved. W1 does not block archiving from a spec-letter standpoint, but maintainers should decide remediation.
