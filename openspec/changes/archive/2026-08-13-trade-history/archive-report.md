# Archive Report: trade-history

**Change**: trade-history
**Capabilities**: trade-history (new — promoted to baseline spec); investment-tracking (modified — delta merged)
**Archived**: 2026-08-13
**Status**: COMPLETE — PASS-WITH-WARNINGS (1 warning resolved at archive time via spec alignment; 1 warning accepted; 4 accepted deviations, user-approved)
**Archive type**: standard — no partial archive; no stale-checkbox reconciliation required (22/22 tasks `[x]` in persisted tasks artifact)

## Review Gate State

Native review gate: **structurally absent** — no `reviewGate` key in structured status for this candidate; no review transaction, ledger, or receipt artifacts exist to read. Archive proceeds under ordinary repository policy per the Native Review Receipt Gate (a present, non-`allow` value is the only blocking case). Runtime ledger: apply attempt **settled passed** (maintainer-approved reset); verify attempt **settled complete**.

## Change Summary

Trades become the ledger for CEDEARs/BYMA positions: buy/sell trade CRUD in USD, chronological running-balance integrity (rejections name the trade to fix), moving-average cost, derived positions, cumulative realized P&L per asset + portfolio total, migration 006 with idempotent seed, and the Inversiones trade UI with es-AR validation and gain/loss chips. `investment-tracking` becomes a derived read model: direct position create/update/delete removed (404), positions table kept only as rollback net. Price charts remain untouched (today's-quantities approximation, TH-7).

## Delivered Scope

- **Domain** (`packages/domain/src/investments/`): `Trade`/`TradeInput`/`RealizedTotals` types, `TradeRepository`/`LegacyPositionPort`/`RealizedLedgerPort` ports, `TradeService` (validate → normalize → timeline simulation → repo; moving average; realized P&L; derived positions with stable negative-hash ids), `DerivedPositionRepository` (legacy id/name merge, no fallback), `PortfolioService` realized totals; `PositionRepository` slimmed to `list()` + `findByTicker()`.
- **Migration/API** (`db/migrations/006_trades.sql`, `apps/api/`): trades table + CHECKs + `idx_trades_ticker_date`; idempotent seed (each position → initial BUY at today's date); price_snapshots rebuilt without the positions FK (see Accepted Deviations); `SqliteTradeRepository` (ORDER BY trade_date, id), `SqliteLegacyPositionRepository`; routes GET/POST `/portfolio/trades`, PUT/DELETE `/portfolio/trades/:id` (201/422/404 semantics), position mutations dropped (404), realized totals in GET /portfolio.
- **Web** (`apps/web/`): `TradeForm` (type/ticker/date/qty/price USD, es-AR parse + validation, rejected-sell feedback), `InvestmentsPage` trade ledger grouped per asset (date desc), realized chips (`badge ok` gain / `badge over` loss), summary row, inline-confirm delete, empty/error/Reintentar states; `PositionForm` deleted; read-only positions table.

## Verification Verdict

Per `verify-report` (validated by `gentle-ai sdd-verify-validate`; evidence revision `sha256:0506a828e3ef6162eba80c64b0474ef198b6f71b706d91075134ead54d806745`, verdict `pass_with_warnings`, blockers 0, critical_findings 0):

- **11/11 requirements verified** (TH-1..TH-7 + investment-tracking delta PI-1/PI-4/PI-6/PI-7); **28/28 scenarios COMPLIANT**.
- **464/464 tests green** (domain 189 + api 145 + web 130; 421 baseline + 43 new); `npm run typecheck` clean in all workspaces; web build ok (vite, 690 modules).
- **Live spot-checks passed**: over-sell rejection 422 naming the trade, moving-average behavior, realized P&L recompute after trade deletion, migration 006 idempotent, position mutations → 404, charts 200.
- Verified code state: `main @ ca5ad80` (merge PR #78; feature-branch-chain PRs #73–#78, tracker merged last — lockstep; trade-group CSS fix `de44496` included in the merged chain). Issue #72 closed.
- **No CRITICAL findings.**

## Verification Warnings and Their Resolution

1. **WARNING 1 — Delta spec-text drift (PI-1)** — RESOLVED AT ARCHIVE TIME by aligning the merged spec text (see "PI-1 Archive-Time Alignment" below). Behavior was always compliant: all scenario assertions were verified via the preserved baseline endpoint `GET /portfolio`; the delta's `GET /api/v1/portfolio/positions` → 404 and its `currency:USD` served field never existed.
2. **WARNING 2 — Design deviation (price_snapshots FK)** — ACCEPTED, NOT remediated. Migration 006 rebuilds `price_snapshots` without the positions FK (commit 88acc3a) — beyond design.md's literal file list. Justified: the FK would reject snapshots for tickers bought after migration (no legacy positions row), breaking PI-3 refresh. Documented in apply-progress.

## PI-1 Archive-Time Alignment (resolution of verification WARNING 1)

Per orchestrator final-state directive, the merged `openspec/specs/investment-tracking/spec.md` PI-1 text names the real shipped read surface:

- Endpoint reference `GET /api/v1/portfolio/positions` → **`GET /portfolio`** in the requirement text and in the "Derived read" scenario's WHEN clause (positions are served by the preserved baseline endpoint, derived from trades, legacy id/name preserved, baseline response shape).
- **`currency:USD` removed** from the served-shape list — the baseline response has no `currency` field; nothing was invented to replace it.
- Minimal Purpose alignment: "positions CRUD" → "positions derived from the trade ledger" (same drift class as WARNING 1).

No endpoints were invented. Scenario behavior assertions were already verified COMPLIANT via `GET /portfolio`; only the drifting delta text changed. The unaligned delta text remains in the archived change folder as the historical record.

## Accepted Deviations (user-approved, NOT remediated)

1. **Migration 006 rebuilds `price_snapshots` without the positions FK** — derived-only tickers have no legacy positions row; justified for PI-3 refresh; documented in apply-progress (commit 88acc3a).
2. **Feature-branch-chain delivery with position-mutation removal** — PRs #73–#78, tracker merged last; lockstep requirement (old web client would break without the API rewrite; migration must land atomically).
3. **Lossy seed migration** — editable BUY seeds dated today; positions table kept as rollback net.
4. **Moving-average vs broker FIFO expectation** — personal tool, not tax filing; accepted in proposal.

## Delivery State

- **PRs #73–#78 MERGED** to main (feature-branch-chain; tracker #78 merged last — lockstep). **Issue #72 closed.** Local main synced and up to date with origin.
- Runtime ledger: apply attempt **settled passed** (maintainer-approved reset); verify attempt **settled complete**.
- Tasks artifact: **22/22 `[x]`** (Phase 1: 5, Phase 2: 3, Phase 3: 6, Phase 4: 3, Phase 5: 5).
- Specs synced:
  - `openspec/specs/trade-history/spec.md` — **CREATED** (new capability; delta promoted byte-identical, `diff -r` empty).
  - `openspec/specs/investment-tracking/spec.md` — **UPDATED** (RENAMED PI-1 + MODIFIED PI-1/PI-4/PI-6/PI-7 merged with the PI-1 alignment; PI-2/PI-3/PI-5 preserved verbatim; no REMOVED requirements).
- Change folder moved to `openspec/changes/archive/2026-08-13-trade-history/` (plain `mv` fallback — folder untracked at archive time; recursive snapshot `diff -r` readback EMPTY, byte-identical).

## Engram Traceability (observation IDs)

| Artifact | Observation ID |
|---|---|
| sdd/trade-history/proposal | #108 |
| sdd/trade-history/spec | #109 |
| sdd/trade-history/design | #110 |
| sdd/trade-history/tasks | #111 |
| sdd/trade-history/apply-progress | #112 |
| sdd/trade-history/verify-report | #113 |
| sdd/trade-history/archive-report (this report) | see Engram topic `sdd/trade-history/archive-report` |

## Next Steps

- Optional, non-blocking (verify-report SUGGESTIONs): refresh apply-progress per-file test counts to match the merged tree; add a vitest coverage script if threshold gates are wanted later.
- Next change candidates (per proposal/prior archives): cripto/bonos/FCIs support, broker import, dividends/fees/commissions, per-period realized filter, FIFO lots.

---

The SDD cycle for trade-history is complete: planned, implemented, verified (PASS-WITH-WARNINGS, no CRITICAL), and archived.
