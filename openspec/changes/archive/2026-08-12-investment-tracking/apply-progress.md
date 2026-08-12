# Apply Progress: investment-tracking

**Change**: investment-tracking (PI-1..PI-7)
**Mode**: Standard (strict_tdd: false; test-first RED→GREEN applied to domain tasks 1.1/2.1/4.1)
**Date**: 2026-08-12
**Chain strategy**: stacked-to-main — `feat/investment-s1` → `feat/investment-s2` → `feat/investment-s3` → `feat/investment-s4` → `feat/investment-s5`, each from the previous, all based on `main` (66716a7). Local only; NO push, NO PRs (orchestrator handles delivery).

## Slices completed

| Slice | Branch | Commit | Changed lines | Verification |
|---|---|---|---|---|
| S1 — Domain foundation | feat/investment-s1 | 62061d1 | 171 | `npm test -w packages/domain` → 133 passed (129 + 4); `npm run typecheck -w packages/domain` clean |
| S2 — PortfolioService | feat/investment-s2 | d3868c4 | 400 | `npm test -w packages/domain` → 143 passed (133 + 10); typecheck clean |
| S3 — Migration + Yahoo + SQLite adapters | feat/investment-s3 | c2d27a5 | 297 | `npm run migrate` ×2 idempotent (004 applied once); `npm test -w apps/api` → 101 passed (93 + 8); typecheck clean |
| S4 — Portfolio routes + wiring | feat/investment-s4 | a8a98f5 | 400 | `npm test -w apps/api` → 111 passed (101 + 10); typecheck clean |
| S5 — Web Inversiones tab | feat/investment-s5 | 1289761 | 506 | `npm test -w apps/web` → 110 passed (104 + 6); `npm run build -w apps/web` OK; typecheck clean |

Total: 1,774 changed lines vs forecast ~1,650. Baseline 326 tests → 364 total (+38 new), zero modifications to existing test files except App.test.tsx (+1 line: mock for the new getPortfolio call).

## Tasks completed (22/22)

- [x] 1.1–1.5 — domain investments module: types, PRICE_TTL_MS ≈ 5 min, normalizeTicker (uppercase + auto `.BA`), ports, index exports
- [x] 2.1–2.2 — PortfolioService: cache-only getPortfolio() (never fetches), CCL-aware USD/ARS valuation, avg-cost P&L abs + %, stale/absent degradation, sequential TTL-gated refresh with force bypass and per-symbol failure isolation
- [x] 3.1–3.5 — migration 004 (positions + price_snapshots, CHECKs, UNIQUE ticker, FK ON DELETE CASCADE), YahooSource (v8 chart, ARS→USD via cached CCL, 429 → 60 s per-ticker cooldown), SqlitePositionRepository, SqlitePriceCache, adapter tests
- [x] 4.1–4.3 — portfolio routes (GET cache-first, POST/PATCH/DELETE with 422/409/404, POST refresh?force), buildApp wiring with CclAccessor over the shared SqliteIndicatorCache, supertest integration suite
- [x] 5.1–5.5 — web client + types, PositionForm (es-AR parsing → USD cents), InvestmentsPage (money-first summary, freshness chips, delete confirm, visibility-gated 5-min auto-refresh, error/empty states), Inversiones tab, component tests
- [x] 6.1 — full `npm test`: domain 143 + api 111 + web 110 = 364, all green
- [x] 6.2 — dev smoke: migrate (idempotent) → dev:api → POST position 201 (auto `.BA`) → duplicate 409 → refresh 200 `updated` (live Yahoo v8) → GET summary (fresh price, CCL `stale` degradation honored, P&L math verified) → DELETE 204 → existing tabs 200; vite dev 200

## Work Unit Evidence (standard mode)

| Slice | Focused test command + result | Runtime harness | Rollback boundary |
|---|---|---|---|
| S1 | `npm test -w packages/domain` — 133 passed, exit 0 | N/A (pure domain) | rm `packages/domain/src/investments/` + tests, revert `index.ts` |
| S2 | `npm test -w packages/domain` — 143 passed, exit 0 | N/A (pure domain) | rm `service.ts` + `service.test.ts` |
| S3 | `npm test -w apps/api` — 101 passed, exit 0 | `npm run migrate` ×2 → 004 applied once, idempotent | drop 004 from db, rm `sources/yahoo.ts`, `sqlite/{positions-repo,price-cache}.ts` |
| S4 | `npm test -w apps/api` — 111 passed, exit 0 | supertest + temp SQLite + stub PriceSource + seeded usd-ccl rows | rm `routes/portfolio.ts`, revert `app.ts` |
| S5 | `npm test -w apps/web` — 110 passed, exit 0; `npm run build -w apps/web` OK | dev smoke: real API on finanzas.db, live Yahoo refresh `updated`, summary + delete 204 | rm page/component/tests, revert `App.tsx`/`api.ts`/`types.ts` |

## Deviations from design

None structural. Two notes:
1. PATCH updates name/quantity/avgCostMinor only — ticker is immutable on edits (snapshots are FK-keyed by ticker; a ticker change would orphan them without a cascade on UPDATE). Design listed PATCH without field semantics; this is the honest minimal contract.
2. S5 slice = 506 changed lines, 106 over the 400-line budget. The approved chain fixes 5 slices and the S5 scope (page + form + tests + client) is indivisible per the design File Changes; the tasks forecast itself anticipated S5 ≈ 420. Tests were trimmed from an initial ~590 to 506; further cuts would remove spec-mandated scenarios (PI-5 visibility gate, PI-6 empty/error/form). Recorded for the verify phase.

## Issues found

- Yahoo live-check: after the successful smoke refresh, manual curl probes hit `429 Edge: Too Many Requests` — the exact burst scenario PI-2 mitigates via per-symbol cooldown (covered by adapter tests).
- S2/S4 initially landed at 442/457 lines; trimmed to ≤400 by consolidating redundant tests and matching the transactions.ts compact style.

## Blockers

None.

## Branch list (local, NOT pushed)

- feat/investment-s1 (62061d1)
- feat/investment-s2 (d3868c4)
- feat/investment-s3 (c2d27a5)
- feat/investment-s4 (a8a98f5)
- feat/investment-s5 (1289761)
