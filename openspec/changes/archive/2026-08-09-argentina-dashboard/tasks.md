# Tasks: Argentina Economic Indicators Dashboard

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1,550–1,600 (S1 190 · S2 290 · S3 390 · S4 320 · S5 410) |
| 400-line budget risk | Medium — S5 borderline; trim tests if diff > 400 |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 → PR #2 → PR #3 → PR #4 → PR #5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (each slice additive, suite green, lands on main in order) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| S1 | Domain foundation: types, catalog, ports, arIsoString, exports | PR #1 (chain base) | `npm test -w packages/domain` | N/A (pure domain) | rm packages/domain/src/indicators/, vo/ar-tz.ts |
| S2 | IndicatorService: TTL, stale, partial-failure + unit tests | PR #2 | `npm test -w packages/domain` | N/A (pure domain) | rm service.ts + service.test.ts |
| S3 | Migration 003 + 4 HTTP sources + mocked-fetch tests | PR #3 | `npm test -w apps/api`; `npm run migrate` | migrate → finanzas.db applies 003 | drop 003, rm apps/api/src/sources/ |
| S4 | SqliteIndicatorCache + /indicators router + integration tests | PR #4 | `npm test -w apps/api` | supertest, temp SQLite, stub sources | rm routes/indicators.ts, indicator-cache.ts |
| S5 | Web: IndicatorsPage, IndicatorCard, tab, tests + EI-7 smoke | PR #5 | `npm test -w apps/web`; `npm test` | dev: migrate → api → web, indicators tab | rm page/component, revert App.tsx/api.ts |

## Phase 1: Domain Foundation (S1)

- [x] 1.1 RED: tests/vo/ar-tz.test.ts + tests/indicators/catalog.test.ts — -03:00 offset, 9 keys, TTL map (EI-3, EI-5)
- [x] 1.2 GREEN: src/vo/ar-tz.ts — arIsoString → America/Argentina/Buenos_Aires ISO (EI-5)
- [x] 1.3 GREEN: src/indicators/types.ts — IndicatorClass/Key/Status/Sample/View/Source/Cache/RefreshResult (EI-1, EI-2)
- [x] 1.4 GREEN: src/indicators/catalog.ts — KEYS, UNIT_BY_KEY (FX ARS/USD, pb, %, millones USD, % TNA), CLASS_BY_KEY, TTL_BY_CLASS (EI-1, EI-3)
- [x] 1.5 GREEN: src/indicators/ports.ts — IndicatorSource, IndicatorCache (EI-2)
- [x] 1.6 Modify: src/index.ts — export indicators module — `npm test -w packages/domain && npm run typecheck -w packages/domain` ✅ 111 tests, typecheck clean

## Phase 2: Domain Service (S2)

- [x] 2.1 RED: tests/indicators/service.test.ts — fakes + FakeClock: fresh/stale/absent derivation; refresh cached (TTL skip)/updated/forced; partial + all-down failure isolation; invalid values (EI-1..EI-4)
- [x] 2.2 GREEN: src/indicators/service.ts — getAll cache-only (no fetch); refresh per-class try/catch, finite-value check, TTL gate, force bypass (EI-1..EI-4) — `npm test -w packages/domain` ✅ 121 tests (17 new), typecheck clean

## Phase 3: API Data (S3)

- [x] 3.1 Create: db/migrations/003_indicators.sql — indicator_snapshots + upsert ON CONFLICT (EI-1) — `npm run migrate` ×2 idempotent ✅ applied once, second run "No pending migrations"
- [x] 3.2 GREEN: src/sources/dolar-api.ts — 5 casas → usd-blue/oficial/tarjeta/mep/ccl, venta, fechaActualizacion, reject ≤0, 10s timeout (EI-1, EI-2)
- [x] 3.3 GREEN: src/sources/bcra.ts — Monetarias 1&7, 45d range, latest {fecha, valor}, reject ≤0 (EI-2)
- [x] 3.4 GREEN: src/sources/datos-gob-ar.ts — series fetch; /search IPC-ID resolution + in-memory ID cache; retry once (EI-2, EI-5) — resolved live: `145.3_INGNACUAL_DICI_M_38` (env override IPC_SERIES_ID)
- [x] 3.5 GREEN: src/sources/argentinadatos.ts — riesgo-pais {valor, fecha}, reject ≤0 (EI-1, EI-2)
- [x] 3.6 Create: tests/sources/*.test.ts — mocked fetch: parse shapes, timeout, malformed JSON, BCRA ≤0, IPC drift → /search retry (EI-2, EI-5) — `npm test -w apps/api` ✅ 70 tests (22 new), typecheck clean. NOTE: slice diff 539 lines vs 390 estimate (coverage overage, see apply-progress)

## Phase 4: API Wiring (S4)

- [x] 4.1 GREEN: src/sqlite/indicator-cache.ts — SqliteIndicatorCache get/set snapshot (EI-1)
- [x] 4.2 RED: tests/indicators.test.ts — supertest + temp SQLite + stub sources: GET fresh/absent/stale (zero fetch), refresh partial/TTL/force, error envelope (EI-1..EI-4)
- [x] 4.3 GREEN: src/http/routes/indicators.ts — GET /api/v1/indicators, POST /api/v1/indicators/refresh?force (EI-1, EI-2, EI-3)
- [x] 4.4 Modify: src/http/app.ts — optional indicatorSources dep + router wiring (EI-1, EI-7) — `npm test -w apps/api && npm run typecheck -w apps/api` ✅ 78 tests (30 new), typecheck clean

## Phase 5: Web Tab (S5)

- [x] 5.1 Modify: src/types.ts, src/api.ts — IndicatorView, getIndicators(), refreshIndicators(force) (EI-1, EI-6)
- [x] 5.2 GREEN: src/components/IndicatorCard.tsx — label, value, unit, relative updatedAt, stale badge (EI-6)
- [x] 5.3 GREEN: src/pages/IndicatorsPage.tsx — useApi GET + 5-min non-forced interval + manual force + loading/error/stale (EI-6)
- [x] 5.4 Modify: src/App.tsx — Indicators tab, read-only (EI-6)
- [x] 5.5 Create: component tests — 9 cards, stale badge, manual refresh, loading/error, interval cleanup (EI-6) — `npm test -w apps/web && npm run build -w apps/web` ✅ 21 tests (6 new), build OK

## Phase 6: Verification (EI-7)

- [x] 6.1 Full `npm test` — domain 104 + api 48 + web 15 baseline green + new tests; run via workspaces, NOT root `npx vitest run` (ignores per-workspace jsdom config → 15 web false failures) ✅ 121 + 79 + 21 = 221 tests, all green; typecheck clean
- [x] 6.2 Dev smoke: migrate → dev:api → dev:web; indicators tab renders 9 cards, refresh updates, existing tabs intact (EI-7) ✅ live refresh 4/4 classes updated; GET serves 9 fresh cards with real values; TTL cached on re-refresh; categories/transactions/summaries 200; vite dev proxies OK

Threat matrix: all rows N/A (design — Express loopback REST only) — no threat RED tasks.
