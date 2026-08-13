```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0506a828e3ef6162eba80c64b0474ef198b6f71b706d91075134ead54d806745
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 11/11
scenarios: 28/28
test_command: npm test (workspaces)
test_exit_code: 0
test_output_hash: sha256:ade54e4ac2d3bb8aa39a953f06efab018d6c95d89fd4769498e74a6d733f1511
build_command: npm run build -w apps/web
build_exit_code: 0
build_output_hash: sha256:4ba7cf36582151cc7f4d35773cabf2eab98d56bf366b2242a77a48280b1f583b
```

## Verification Report

**Change**: trade-history
**Version**: N/A (delta specs)
**Mode**: Standard
**Date**: 2026-08-13
**Evidence basis**: merged main @ ca5ad80 (PR #78, includes CSS fix de44496) + independent runtime execution

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 22 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Tests**: ✅ 464 passed / ❌ 0 failed / ⚠️ 0 skipped (domain 189 + api 145 + web 130; 421 baseline + 43 new)
```text
$ npm test
packages/domain   Test Files 19 passed (19)   Tests 189 passed (189)
apps/api          Test Files 14 passed (14)   Tests 145 passed (145)
apps/web          Test Files 13 passed (13)   Tests 130 passed (130)
exit code 0
```

**Typecheck**: ✅ `npm run typecheck` → tsc --noEmit clean in all 3 workspaces (exit 0)
```text
output hash sha256:6497e57060d356229e6aa7b63d6ff836058b986528a49a73e6eb6b9d2b0f58af
```

**Build**: ✅ `npm run build -w apps/web` → vite build, 690 modules (exit 0)

**Coverage**: ➖ Not available (no coverage script configured in any workspace)

### Spec Compliance Matrix

#### trade-history (18 scenarios)

| Req | Scenario | Covering test / evidence | Result |
|-----|----------|--------------------------|--------|
| TH-1 | Create buy with normalization | `apps/api/tests/trades.test.ts > creates a buy with ticker uppercased + .BA`; `packages/domain/tests/investments/trades.test.ts > normalizes the ticker`; live: `meli` → `MELI.BA` 201 | ✅ COMPLIANT |
| TH-1 | Validation failures | api `rejects invalid input with 422 and persists nothing`; live: 5×422 (qty 0, price 0, bad type, ARS, bad date) | ✅ COMPLIANT |
| TH-1 | Unknown id | api `returns 404 for an unknown id`; live: PUT/DELETE 99999 → 404 | ✅ COMPLIANT |
| TH-2 | Sell exceeding balance | api `rejects an oversold sell with 422 naming the trade`; live: sell 11 with balance 10 → 422 `sell of 11 MELI.BA … exceeds balance 10; fix that sell first` | ✅ COMPLIANT |
| TH-2 | Valid sell | live: sell 8 YPF.BA → 201, balance honored; valid sells exercised in api timeline tests and portfolio full-sold test | ✅ COMPLIANT |
| TH-2 | Invalidating edit/delete | api `rejects an edit invalidating a later sell, naming that sell` + delete twin; domain twins; live: buy 10→5 with sell 8 → 422 `(id 8) exceeds balance 5`; delete → 422 `balance 0` | ✅ COMPLIANT |
| TH-2 | Same-day determinism | domain `computes same-day balances in insertion order (id)`; api `lists trades by date, then insertion order on the same date` | ✅ COMPLIANT |
| TH-3 | Averaging buys | domain `averages buys into one moving-average cost`; live: 10@20000 + 10@22000 → 21000 | ✅ COMPLIANT |
| TH-3 | Sell leaves average | domain `keeps the moving average unchanged on a sell`; live: avg stayed 21000 after sell | ✅ COMPLIANT |
| TH-3 | Full sale resets | domain `drops a fully sold ticker and restarts the average`; api `treats a fully sold ticker as gone until the next buy`; live: full sell → position gone, next buy avg 30000 | ✅ COMPLIANT |
| TH-4 | Gain | domain `credits a gain per asset and portfolio`; live: sell 5@25000 vs avg 21000 → +20000 | ✅ COMPLIANT |
| TH-4 | Loss | domain `records losses negative`; api `records realized losses negative per asset and portfolio (TH-4)`; live: sell 4@15000 vs avg 20000 → −20000 | ✅ COMPLIANT |
| TH-5 | Seed matches pre-migration values | `apps/api/tests/trades-repo.test.ts > seeds one BUY trade per position once…`; live: 2 positions → 2 BUY rows, today's date, exact qty/avg | ✅ COMPLIANT |
| TH-5 | Idempotent seed | same test re-run asserts `[]`; live: 2nd migrate → `[]`, count stays 2; seed row editable (UPDATE affected 1) | ✅ COMPLIANT |
| TH-6 | Render and empty state | `InvestmentsPage.test.tsx > renders trades grouped per asset, date desc, with realized chips` + `shows empty states…` | ✅ COMPLIANT |
| TH-6 | Rejected sell feedback | `TradeForm.test.tsx > shows the rejected-sell timeline error in es-AR naming the trade` (translateTradeDetail) | ✅ COMPLIANT |
| TH-6 | Fetch failure | `InvestmentsPage.test.tsx > shows the portfolio/trades fetch error with Reintentar` | ✅ COMPLIANT |
| TH-7 | Charts and suites untouched | `history.test.ts` 9/9 green — diff is fixtures-only (BUY-trade seeding + `AAPL.BA` cache keys, assertions unchanged); no other capability file changed; full suite green | ✅ COMPLIANT |

#### investment-tracking delta (10 scenarios)

| Req | Scenario | Covering test / evidence | Result |
|-----|----------|--------------------------|--------|
| PI-1 | Derived read | `apps/api/tests/portfolio.test.ts > serves positions derived from trades with legacy id/name preserved`; live GET /portfolio: AAPL.BA qty 12 avg 18000, ticker-ordered. NOTE: delta names `GET /portfolio/positions` (→404); all scenario assertions are served via the preserved baseline endpoint `GET /portfolio` (delta migration note: "read endpoints keep their response shape") — endpoint-name drift tracked as WARNING 1 for archive-time text alignment | ✅ COMPLIANT |
| PI-1 | Mutation via trades only | portfolio `returns 404 for POST/PATCH/DELETE on positions`; live: POST/PUT/DELETE → 404 | ✅ COMPLIANT |
| PI-1 | Trade change recomputes | portfolio `recomputes derived values after a trade change without forced refetch (PI-1)`; live: realized 20000→15000 after buy delete | ✅ COMPLIANT |
| PI-1 | Id and name preservation | domain `preserves the legacy id and name` / `derives a negative-hash id`; live: id 1 "Apple", MELI.BA id −419776707 name=ticker | ✅ COMPLIANT |
| PI-4 | Full valuation | portfolio `returns fresh views with USD/ARS values, P&L and totals` | ✅ COMPLIANT |
| PI-4 | CCL degradation | portfolio `uses a stale CCL with ccStatus stale and degrades to USD-only when absent` | ✅ COMPLIANT |
| PI-4 | Derived avg-cost P&L | portfolio `uses the derived moving average for P&L (PI-4)` | ✅ COMPLIANT |
| PI-6 | Render and empty state | `InvestmentsPage.test.tsx > renders the read-only positions table and the money-first summary with realized P&L` + empty states | ✅ COMPLIANT |
| PI-6 | Fetch failure | `InvestmentsPage.test.tsx > shows the portfolio fetch error… Reintentar reloads` | ✅ COMPLIANT |
| PI-7 | Other suites unchanged | full suite 464 green; only `history.test.ts` fixtures touched; zero changes to indicators/expense/categories/budgets/summaries code or tests | ✅ COMPLIANT |

**Compliance summary**: 28/28 scenarios compliant (PI-1 Derived read carries a delta-text endpoint-name drift — behavior verified via GET /portfolio — escalated as WARNING 1 for archive)

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| TH-1 Trades CRUD | ✅ Implemented | `TradeService` validate→normalize→repo; routes GET/POST/PUT/DELETE `/portfolio/trades`; 201/422/404 semantics |
| TH-2 Timeline integrity | ✅ Implemented | chronological simulation over all trades (date,id); rejection details name the trade; buy always allowed; negative balance impossible |
| TH-3 Moving average | ✅ Implemented | buy updates avg `(q·a+Q·p)/Σ`, sell keeps, full-sale → quantity 0, fresh start |
| TH-4 Realized P&L | ✅ Implemented | derived on read (D6); per asset + portfolio totals, losses negative, avg-at-sell-time |
| TH-5 Migration 006 | ✅ Implemented | idempotent seed from positions, today's date, editable rows, positions untouched |
| TH-6 Web | ✅ Implemented | TradeForm es-AR, grouped list, chips ok/over, inline confirm, Reintentar, empty states |
| TH-7 Zero regression | ✅ Implemented | only fixture edits outside the change surface |
| PI-1 Derived positions | ✅ Implemented | derived read model; mutations removed (404); legacy id/name merge; stable negative-hash ids; no fallback |
| PI-4 Valuation | ✅ Implemented | realizedUsdMinor in totals; derived avg-cost P&L; CCL stale/absent degradation |
| PI-6 Web tab | ✅ Implemented | read-only positions table, realized summary row, PositionForm deleted |
| PI-7 Zero regression | ✅ Implemented | other capability suites untouched and green |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Derivation in pure-TS TradeService + thin adapter | ✅ Yes | `trades.ts` + `derived-repo.ts` |
| D2 Legacy read-only port, no fallback | ✅ Yes | test `exposes no position for tickers without trades, even with a legacy record` |
| D3 Stable negative hash derived id | ✅ Yes | live −419776707 for MELI.BA |
| D4 PUT full replace | ✅ Yes | `router.put /portfolio/trades/:id` |
| D5 Removed mutations → 404 | ✅ Yes | live 404 ×3 |
| D6 Realized derived on read | ✅ Yes | live recompute after delete |
| D7 ORDER BY trade_date, id | ✅ Yes | repo + live listing |
| D8 Chips: gain `badge ok`, loss `badge over` | ✅ Yes | `badgeClass` in InvestmentsPage |
| D9 PositionRepository slimmed | ✅ Yes | ports.ts = list() + findByTicker() only |
| (additive) price_snapshots FK rebuild in 006 | ⚠️ Deviation | beyond design file list; justified for PI-3 (derived-only tickers), documented in apply-progress |

### Issues Found

**CRITICAL**: None.

**WARNING**:
1. *Delta spec-text drift (PI-1)*: delta requirement/scenario name `GET /api/v1/portfolio/positions` as the derived read endpoint and list `currency:USD` among served fields. Implementation serves derived positions via the preserved baseline endpoint `GET /portfolio` (delta migration note: "read endpoints keep their response shape") and `GET /portfolio/positions` → 404; `PositionView` has no `currency` field (baseline never had one). All scenario assertions are behaviorally satisfied and covered by passing tests via GET /portfolio, so the scenario counts compliant; archive must still align the delta text (rename endpoint reference to GET /portfolio, drop currency from the served-shape list) or add an alias route.
2. *Design deviation (price_snapshots FK)*: migration 006 additionally rebuilds `price_snapshots` without the positions FK (commit 88acc3a) — beyond design.md's literal file list. Justified: the FK would reject snapshots for tickers bought after migration (no legacy positions row), breaking PI-3 refresh. Does not break any spec.

**SUGGESTION**:
1. apply-progress per-file test counts (trades 10, TradeForm 7, portfolio 13, InvestmentsPage 17) differ from the merged tree (9/6/11/19) though workspace totals match (api 145, web 130, total 464). Refresh those counts for documentation accuracy.
2. No coverage script configured in any workspace — coverage evidence unavailable (➖). Optional: add vitest coverage if threshold gates are desired later.
3. Full-suite runtime verification via `npm test` includes all workspaces; the per-workspace `typecheck` was run via root `npm run typecheck` (workspaces). Both captured with exit 0.

### Verdict

**PASS WITH WARNINGS**

All runtime gates green (464/464 tests, typecheck clean, build ok, live API behavioral checks match specs), 22/22 tasks complete, 28/28 scenarios compliant, with one delta-text alignment item for the archive phase.
