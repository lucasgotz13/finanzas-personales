# Proposal: Trade History

## Intent

Positions today are one manual average-cost snapshot per asset: no operation record, no realized P&L, and charts approximate history using today's quantities. Trades become the ledger — derived positions and visible realized P&L; charts stay as-is.

## Assumptions

Locked (user):
1. Moving average: realized = sell price − avg cost at sell time; buys update it, sells don't.
2. Migration: each position → initial BUY trade at avg_cost, today's date, editable; positions table kept as rollback net.
3. USD cents, consistent with positions.
4. Realized P&L: cumulative per asset + portfolio total.
5. Running balance per ticker never negative; invalidating edits/deletes rejected, naming the trade to fix.
6. quantity = Σ buys − Σ sells; positions endpoints read derived data.

Also: single user; seed trades editable.
Charts remain unchanged (today's-quantities approximation with the honesty note) — user preference; price-charts capability untouched.

## Scope

In: trades CRUD (buy/sell, date, quantity, priceMinor USD) + balance validation and rejection messaging; derived positions (quantity, moving-average cost); realized P&L per asset + portfolio; migration 006 + seed; web trade list/form and realized P&L in Inversiones.

Out: dividends, fees/commissions, taxes, broker import, FIFO lots, short sells, per-period realized filter.

## Capabilities

New:
- `trade-history`: operations ledger, balance validation, derived positions, moving-average realized P&L.

Modified:
- `investment-tracking`: positions become derived read model; direct qty/avgCost editing disappears.

## Approach

- **Domain**: Trade type, TradeRepository, TradeService (validation, moving-average cost, realized P&L); PortfolioService derives positions + realized totals.
- **API**: new `/portfolio/trades` CRUD; positions serve derived data.
- **Migration 006**: trades table + seed (positions → BUY at avg_cost).
- **Web**: TradeForm/trade list, realized P&L card.

## Affected Areas

| Area | Impact |
|------|--------|
| `packages/domain/src/investments/` | New/Modified — Trade, TradeRepository, TradeService |
| `apps/api/src/http/routes/portfolio.ts` | Modified — trades CRUD, derived positions |
| `apps/api/src/sqlite/` | New trades-repo; positions-repo read-only |
| `db/migrations/006_trades.sql` | New — trades table + seed |
| `apps/web/` | Modified — InvestmentsPage, TradeForm, realized P&L |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Lossy production migration (wrong seed dates) | High | backup + editable seed trades |
| API surface change vs deployed client | Med | lockstep deploy |
| Edit/delete invalidates later sells | Med | strict validation + clear errors |
| Realized P&L differs from broker FIFO | High | personal tool, not tax filing |

## Rollback Plan

Positions table stays untouched as safety net. Revert: stop API, redeploy previous build, drop trades table via cleanup migration.

## Dependencies

None external.

## Success Criteria

- [ ] Trades CRUD works; invalid edits/deletes rejected with explanation
- [ ] Derived positions match pre-migration displayed values exactly
- [ ] Realized P&L correct: cumulative per asset + portfolio total
- [ ] Zero regression on price-charts (capability untouched)
- [ ] All tests green: existing updated + new trade domain
- [ ] Seed trades editable through the UI
