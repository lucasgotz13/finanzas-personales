```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:da9681c5a9dd1565172319c21e8bb6cb5d2c4fb8d8e23de04e21f738cbc462e6
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 15/15
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:972da10816d2d47104275265543cdb30c09b86102dedb0a50f7aa8e334105809
build_command: npm run typecheck && npm run build -w apps/web
build_exit_code: 0
build_output_hash: sha256:4f49495836d4800c66d33b30831c30910cc639ee63ac7a30abedf5dcd172538c
```

## Verification Report

**Change**: investment-tracking
**Version**: N/A (delta spec without version header)
**Mode**: Standard (strict_tdd: false)
**Date**: 2026-08-12
**Evidence basis**: independent test execution + typecheck + web build, 17 independent behavioral spot-checks against the full stack (temp SQLite + stub source), and live Yahoo v8 probes. `evidence_revision` = sha256 over the concatenation of the exact test output, build output, and spot-check output files.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 22 |
| Tasks incomplete | 0 |
| Artifacts present | proposal, design, specs, tasks, apply-progress |

### Build & Tests Execution

**Build**: ✅ Passed — `npm run typecheck` (domain, api, web; exit 0) + `npm run build -w apps/web` (vite 7.3.6, 61 modules; exit 0).

**Tests**: ✅ 364 passed / ❌ 0 failed / ⚠️ 0 skipped — `npm test` via workspaces (never root npx vitest), exit 0.

```text
> npm test --workspaces --if-present
@finanzas/domain  vitest run → 15 files, 143 tests passed
@finanzas/api     vitest run →  9 files, 111 tests passed
@finanzas/web     vitest run → 12 files, 110 tests passed
Total: 364 passed (143 + 111 + 110), exit 0
```

Baseline consistency: 364 − 38 new tests (domain +14, api +18, web +6) = 326 — exactly the declared PI-7 baseline. Total diff vs baseline commit 66716a7: 1,767 insertions + 7 deletions = 1,774 changed lines, matching apply-progress's claim precisely.

**Coverage**: ➖ Not available (no coverage tooling configured in this repo).

**Independent spot-checks**: ✅ 17/17 passed — full-stack supertest against temp SQLite (normalization `aapl→AAPL.BA` 201, duplicate 409, currency ARS 422, quantity 0 422, cache-first GET with zero source calls, fresh/stale/absent statuses, CCL stale→last-known + `ccStatus`, CCL absent→USD-only, mixed refresh `updated|cached|failed`, TTL gate → `cached` with zero fetches, `force=true` → `updated`, hard delete 204 + snapshot cascade) plus a live Yahoo probe.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| PI-1 | Create (auto .BA) | `apps/api/tests/portfolio.test.ts > creates with ticker uppercased + .BA, USD currency and name defaulting` | ✅ COMPLIANT |
| PI-1 | Validation and duplicates | `portfolio.test.ts > rejects invalid input with 422...` + `rejects a duplicate ticker with 409` | ✅ COMPLIANT |
| PI-1 | Quantity change recomputes | `portfolio.test.ts > updates quantity and recomputes valuation without refetching` | ✅ COMPLIANT |
| PI-1 | Hard delete | `portfolio.test.ts > hard-deletes the position and cascades its snapshots` | ✅ COMPLIANT |
| PI-2 | Happy fetch | `apps/api/tests/sources/yahoo.test.ts > returns a USD quote in cents...` + live probe (see notes) | ✅ COMPLIANT |
| PI-2 | Failure modes | `yahoo.test.ts > 404 / NaN / malformed JSON / 429+60s cooldown` | ✅ COMPLIANT |
| PI-3 | Cache-first read | `portfolio.test.ts > returns fresh views... — zero source calls` + `serves expired snapshots as stale and snapshot-less positions as absent` | ✅ COMPLIANT |
| PI-3 | TTL-respecting refresh | `packages/domain/tests/investments/service.test.ts > skips symbols within TTL...` + `force=true bypasses TTL` | ✅ COMPLIANT |
| PI-4 | Full valuation | `service.test.ts > values USD and ARS via CCL, with avg-cost P&L abs + % per position and totals` | ✅ COMPLIANT |
| PI-4 | CCL degradation | `service.test.ts > uses a stale CCL...` + `degrades to USD-only when no CCL` + `portfolio.test.ts > uses a stale CCL with ccStatus stale` | ✅ COMPLIANT |
| PI-5 | Mixed batch | `portfolio.test.ts > refreshes sequentially with mixed updated/cached/failed and keeps the prior cache` | ✅ COMPLIANT |
| PI-5 | Visibility-gated refresh | `apps/web/src/pages/__tests__/InvestmentsPage.test.tsx > auto-refreshes non-forced every 5 min while visible and pauses when hidden` | ✅ COMPLIANT |
| PI-6 | Render and empty state | `InvestmentsPage.test.tsx > renders the positions table with freshness chips and the money-first summary` + `shows the empty state` | ✅ COMPLIANT |
| PI-6 | Fetch failure | `InvestmentsPage.test.tsx > shows the fetch error in a role=alert box and Reintentar reloads` | ✅ COMPLIANT |
| PI-7 | Existing suite + additive routes | full `npm test` (364 green) + additive-only diff vs 66716a7 | ✅ COMPLIANT |

**Compliance summary**: 15/15 scenarios compliant, all backed by tests that passed at runtime.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| PI-1 Positions CRUD | ✅ Implemented | `normalizeTicker` uppercase + auto `.BA` (catalog.ts); repo create/update/list/findByTicker/hard delete (positions-repo.ts); routes: 201, 422 ValidationError, 409 ConflictError, 404, 204; `currency` fixed 'USD'; list `ORDER BY ticker` |
| PI-2 Yahoo price fetch | ✅ Implemented | yahoo.ts GETs v8 chart with `interval=1d&range=1d`, one symbol per request, finite `regularMarketPrice` check, ARS→USD via injected CCL (null CCL → throw → `failed`), 404/NaN/malformed/429 → throw, 60 s per-ticker cooldown |
| PI-3 Snapshot cache | ✅ Implemented | `price_snapshots` upsert cache (price-cache.ts), `PRICE_TTL_MS = 5 min`, `getPortfolio()` cache-only (never fetches), fresh/stale/absent vs TTL, non-forced refresh skips age ≤ TTL, `force=true` bypasses |
| PI-4 Valuation | ✅ Implemented | per-position USD value, ARS via CCL, P&L abs + %, totals; stale CCL → last known + `ccStatus:"stale"`; absent CCL → ARS null (USD-only, never blank); snapshot-less positions excluded with '—'/absent |
| PI-5 Refresh | ✅ Implemented | `POST /portfolio/refresh` sequential (one in-flight), per-symbol `{status: updated|cached|failed, error?}`, TTL gate + force; web 5-min interval only while visible, resumes on visibilitychange |
| PI-6 Web tab | ✅ Implemented | Inversiones tab, money-first summary (ARS big, USD secondary, P&L chip), fresh/stale/absent chips, PositionForm with es-AR parsing, delete confirm, empty state, error + Reintentar, green refresh (`.primary` = `--action: #0e7a3d`) |
| PI-7 Zero regression | ✅ Implemented | only additive diffs to existing files (index.ts exports, app.ts wiring, App.tsx tab, helpers.ts DI param, App.test.tsx mock line); zero changes to existing specs, core logic, or routes; 326 baseline preserved |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| CCL read-only via `PortfolioFxPort`; `CclAccessor` wraps the same `SqliteIndicatorCache` | ✅ Yes | app.ts lines 38–45, 74–82 |
| ARS→USD normalization in the adapter; domain sees only USD cents | ✅ Yes | yahoo.ts converts; service validates finite USD cents |
| quantity REAL + CHECK > 0 | ✅ Yes | migration 004 |
| FK ON DELETE CASCADE for snapshots | ✅ Yes | migration 004 + integration test proves cascade |
| 429 → 60 s per-symbol in-memory cooldown + sequential loop | ✅ Yes | yahoo.ts + service.ts |
| CCL freshness reuses fx TTL; stale → last known + ccStatus; absent → USD-only | ✅ Yes | `CCL_TTL_MS = TTL_BY_CLASS.fx` |
| P&L formulas `(price−avgCost)×qty` and `(price−avgCost)/avgCost` | ✅ Yes | service.ts matches design formulas exactly |
| REST contract: GET cache-first, POST 409/422, PATCH/DELETE, refresh?force | ✅ Yes | routes/portfolio.ts |
| File changes list | ✅ Yes | every file in design File Changes exists with the designed role |

### Issues Found

**CRITICAL**: None.

**WARNING**:

1. *Scenario count discrepancy (process-level)*: the orchestrator launch context declared 13 scenarios; the retrieved authoritative spec contains 7 requirements and 15 scenarios (PI-1 has 4 scenarios, PI-2..PI-6 have 2 each, PI-7 has 1). This verification counted and validated against the retrieved totals (7/15). Zero code impact — suggest reconciling the orchestrator context during archive.
2. *Yahoo meta.currency residual data risk (pre-accepted)*: current live behavior verified — Yahoo v8 reported `meta.currency:"ARS"` for AAPL.BA/GGAL.BA/YPFD.BA and the adapter converted via the cached CCL correctly (AAPL.BA ≈ 23,954 ARS → 17.81 USD @ CCL 1,345 and 11.98 USD @ CCL 2,000 — the quote scales exactly with CCL, proving the conversion path). Residual risk from the accepted "BYMA prices labeled USD" note: if Yahoo ever labels an ARS value as `"USD"`, the adapter stores it unconverted (ARS number as USD cents). Accepted in apply; risk stands as data-quality caveat.

**SUGGESTION**:

1. apply-progress wording: "zero modifications to existing test files except App.test.tsx" is imprecise — `apps/api/tests/helpers.ts` was also modified (+11 lines, additive `portfolioSource` DI parameter). Additive-only change; no PI-7 violation.
2. `PATCH /portfolio/positions/:id` resolves the row via `positions.list().find(...)` — an O(n) scan; a by-id repository lookup would be cleaner and scale better.
3. Design work-unit sketch listed 4 WUs; tasks.md planned 5 slices (S1–S5). Apply followed tasks.md (stacked-to-main, all merged). Worth syncing the planning artifact wording during archive.

### Accepted Items Verified

- **S5 slice overage**: 506 changed lines vs the 400-line budget; `size:exception` approved by the orchestrator. Slice scope (page + PositionForm + client + component tests) matches the design File Changes and is indivisible; the overage is fully covered by tests.
- **PATCH ticker immutability**: ticker is immutable on edit (snapshots FK-keyed by ticker); design did not specify field semantics, and the spec does not require ticker edits. Honest minimal contract — accepted.

### Verdict

PASS WITH WARNINGS — 15/15 scenarios compliant with runtime-passing covering tests, 364/364 tests green, typecheck and build clean, 17/17 independent spot-checks passed, live Yahoo conversion path verified; warnings are one process-context count discrepancy and one pre-accepted residual data risk, neither breaking any spec.
