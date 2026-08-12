# Proposal: Investment Tracking

## Intent

The user sees their real portfolio value (ARS + USD) and simple per-position/overall P&L using the app's own FX honesty (CCL). Same ritual as the indicators tab: weekly "cuánto vale mi cartera", honest prices, never a blank screen.

## Assumptions

- LOCKED v1 classes: CEDEARs + BYMA stocks only (cripto, bonos, FCIs OUT).
- Source: Yahoo v8 chart, keyless, verified live. Degradation like indicators: snapshot cache, per-class TTL, fresh/stale/absent; one symbol per request, try/catch + cooldown (429s).
- Valuation: USD (native) → ARS via CCL from existing dolarapi cache.
- P&L v1: average cost basis (quantity + avg price + optional date). No buy transactions.
- Refresh: auto ~5 min while tab visible (IndicatorsPage pattern) + manual button.
- Ticker rule (simplest honest): uppercase; auto-append `.BA` when missing; reject empty/invalid. v1 only accepts BYMA symbols.
- Single user, no auth, manual entry. Money/FX VOs reused untouched.

## Scope

### In Scope
- Positions CRUD: ticker, name, quantity, avg cost, currency
- YahooPriceSource adapter; refresh with per-class TTL + cooldown
- Summary: per-position price, value USD, value ARS (CCL), P&L abs + %; totals
- Web tab "Inversiones" (money-first, chips, One Green Rule)
- Migration 004: positions + price_snapshots

### Out of Scope
- Cripto, bonos, FCIs; buy/sell history; dividends; broker import; charts; tax reports; alerts; multi-portfolio

## Capabilities

### New Capabilities
- `investment-tracking`: positions CRUD, Yahoo price fetch with snapshot cache + TTL, CCL valuation, avg-cost P&L, summary UI.

### Modified Capabilities
- None

## Approach

Mirror economic-indicators 1:1. Domain `packages/domain/src/investments/`: Asset/Position/Price entities, PriceSource + PositionRepository ports, PortfolioService (CCL from dolarapi cache, avg-cost P&L). Adapters in `apps/api`: `sources/yahoo.ts`, `sqlite/positions-repo.ts`, `price-cache.ts`. Migration 004. REST `/api/v1/portfolio/*`. Web: InvestmentsPage + tab, AUTO_REFRESH pattern. ZERO changes to existing capabilities.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/domain/src/investments/` | New | entities, ports, service, TTL catalog |
| `apps/api/src/sources/yahoo.ts` | New | v8 chart adapter, per-symbol |
| `apps/api/src/sqlite/` | New | positions-repo, price-cache |
| `db/migrations/004_investments.sql` | New | positions, price_snapshots |
| `apps/api/src/http/routes/portfolio.ts` | New | REST routes |
| `apps/web/src/` | New | InvestmentsPage, tab |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Yahoo v8 follows v7 to auth-wall | Med | cache + stale + swappable port |
| Yahoo 429 on bursts | High | per-symbol requests + cooldown |
| CCL-only valuation is a product decision | Low | documented; FX choice swappable |
| Scope creep (history, charts) | Med | explicit OUT list |

## Rollback Plan

Revert commit: drop tab, routes, adapters, domain module; roll back migration 004. Additive only — core untouched.

## Dependencies

- Yahoo v8 chart (keyless, verified 2026-08-12)
- Existing dolarapi adapter (usd-ccl, 5-min TTL)

## Success Criteria

- [ ] CRUD persists and renders
- [ ] Refresh fetches Yahoo prices; stale fallback never blanks screen
- [ ] Per-position P&L (abs + %) and totals ARS/USD via CCL
- [ ] Auto-refresh only while tab visible; manual forces
- [ ] All 326 tests pass unchanged (zero core diffs)
