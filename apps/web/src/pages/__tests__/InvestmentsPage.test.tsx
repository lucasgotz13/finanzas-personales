import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { formatChartMoney } from '../../components/SeriesChart';
import type { HistoryResponse, PortfolioSummary, Trade } from '../../types';
import InvestmentsPage from '../InvestmentsPage';

const FIVE_MINUTES = 5 * 60_000;

function history(points: Array<{ date: string; valueMinor: number }> = []): HistoryResponse {
  return { points, currency: 'ARS', range: '3m', status: 'fresh' };
}

function summary(): PortfolioSummary {
  return {
    ccStatus: 'fresh',
    totals: { valueUsdMinor: 200000, valueArsMinor: 269000000, pnlUsdMinor: 20000, pnlPct: 0.1111, pnlArsMinor: 26900000, realizedUsdMinor: 21000 },
    positions: [
      { id: 1, ticker: 'AAPL.BA', name: 'Apple', quantity: 10, avgCostMinor: 18000, priceMinor: 20000, status: 'fresh', valueUsdMinor: 200000, valueArsMinor: 269000000, pnlUsdMinor: 20000, pnlPct: 0.1111, pnlArsMinor: 26900000, realizedUsdMinor: 21000 },
      { id: 2, ticker: 'GGAL.BA', name: 'Galicia', quantity: 5, avgCostMinor: 6000, priceMinor: null, status: 'absent', valueUsdMinor: null, valueArsMinor: null, pnlUsdMinor: null, pnlPct: null, pnlArsMinor: null, realizedUsdMinor: -4000 },
    ],
  };
}

function trades(): Trade[] {
  return [
    { id: 1, ticker: 'AAPL.BA', type: 'buy', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' },
    { id: 2, ticker: 'AAPL.BA', type: 'sell', date: '2026-08-05', quantity: 3, priceMinor: 25000, currency: 'USD' },
    { id: 3, ticker: 'GGAL.BA', type: 'buy', date: '2026-08-02', quantity: 5, priceMinor: 6000, currency: 'USD' },
  ];
}

function mockPortfolioAndTrades(): void {
  vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
  vi.spyOn(api, 'listTrades').mockResolvedValue(trades());
}

describe('InvestmentsPage (PI-6, TH-6)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (document as { visibilityState?: unknown }).visibilityState;
    delete (document as { hidden?: unknown }).hidden;
  });

  it('renders the read-only positions table and the money-first summary with realized P&L', async () => {
    mockPortfolioAndTrades();

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('positions-table')).toBeInTheDocument();
    expect(screen.getByTestId('position-1')).toHaveTextContent('Apple');
    expect(screen.getByTestId('position-1')).toHaveTextContent('Al día');
    expect(screen.getByTestId('position-2')).toHaveTextContent('Sin precio');
    // Derived positions are read-only: no edit/delete actions remain.
    expect(screen.getByTestId('position-1')).not.toHaveTextContent('Borrar');
    expect(screen.getByTestId('portfolio-summary')).toHaveTextContent('ARS (CCL)');
    expect(screen.getByTestId('portfolio-summary')).toHaveTextContent('2.690.000,00');
    expect(screen.getByTestId('portfolio-summary')).toHaveTextContent('2.000,00');
    expect(screen.getByTestId('portfolio-summary')).toHaveTextContent('+11,11%');
    expect(screen.getByTestId('realized-total')).toHaveTextContent('Ganancia');
  });

  it('renders trades grouped per asset, date desc, with realized chips per asset', async () => {
    mockPortfolioAndTrades();

    render(<InvestmentsPage />);

    const aapl = await screen.findByTestId('trade-group-AAPL.BA');
    const aaplRows = within(aapl).getAllByRole('row').slice(1);
    expect(aaplRows.map((row) => row.getAttribute('data-testid'))).toEqual(['trade-2', 'trade-1']); // date desc
    expect(within(aapl).getByText('Compra')).toBeInTheDocument();
    expect(within(aapl).getByText('Venta')).toBeInTheDocument();
    expect(aapl).toHaveTextContent('Realizado: US$ 210,00');
    expect(aapl).toHaveTextContent('Ganancia');

    const ggal = screen.getByTestId('trade-group-GGAL.BA');
    expect(ggal).toHaveTextContent('Realizado: -US$ 40,00');
    expect(ggal).toHaveTextContent('Pérdida');
  });

  it('shows empty states when there are no trades and no positions', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue({ ccStatus: 'absent', totals: { valueUsdMinor: 0, valueArsMinor: null, pnlUsdMinor: 0, pnlPct: null, pnlArsMinor: null, realizedUsdMinor: 0 }, positions: [] });
    vi.spyOn(api, 'listTrades').mockResolvedValue([]);

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('trades-empty')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('positions-table')).not.toBeInTheDocument();
  });

  it('shows the portfolio fetch error in a role=alert box and Reintentar reloads', async () => {
    const getPortfolio = vi.spyOn(api, 'getPortfolio').mockRejectedValue(new Error('api caída'));
    vi.spyOn(api, 'listTrades').mockResolvedValue([]);
    const user = userEvent.setup();

    render(<InvestmentsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('api caída');
    await user.click(screen.getByTestId('retry-portfolio'));
    await vi.waitFor(() => expect(getPortfolio).toHaveBeenCalledTimes(2));
  });

  it('shows the trades fetch error with Reintentar that reloads', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    const listTrades = vi.spyOn(api, 'listTrades').mockRejectedValue(new Error('sin operaciones'));
    const user = userEvent.setup();

    render(<InvestmentsPage />);

    expect(await screen.findByText('sin operaciones')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-trades'));
    await vi.waitFor(() => expect(listTrades).toHaveBeenCalledTimes(2));
  });

  it('creates a trade through the form, edits one prefilled and deletes one after confirmation', async () => {
    mockPortfolioAndTrades();
    const create = vi.spyOn(api, 'createTrade').mockResolvedValue({ id: 4, ticker: 'MELI.BA', type: 'buy', date: '2026-08-06', quantity: 2, priceMinor: 50000, currency: 'USD' });
    const update = vi.spyOn(api, 'updateTrade').mockResolvedValue({ id: 2, ticker: 'AAPL.BA', type: 'sell', date: '2026-08-05', quantity: 4, priceMinor: 25000, currency: 'USD' });
    const del = vi.spyOn(api, 'deleteTrade').mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<InvestmentsPage />);
    await screen.findByTestId('trade-group-AAPL.BA');

    await user.type(screen.getByTestId('trade-ticker'), 'meli');
    await user.type(screen.getByTestId('trade-quantity'), '2');
    await user.type(screen.getByTestId('trade-price'), '500');
    await user.click(screen.getByTestId('submit'));
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ ticker: 'meli', quantity: 2, priceMinor: 50000 })));

    // Edit mode prefills the trade and PUTs on submit.
    const editButtons = await screen.findAllByText('Editar');
    await user.click(editButtons[0]); // AAPL sell (id 2), first row of the group
    expect(screen.getByTestId('trade-ticker')).toHaveValue('AAPL.BA');
    expect(screen.getByTestId('trade-quantity')).toHaveValue('3');
    await user.clear(screen.getByTestId('trade-quantity'));
    await user.type(screen.getByTestId('trade-quantity'), '4');
    await user.click(screen.getByTestId('submit'));
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith(2, expect.objectContaining({ quantity: 4 })));

    // Inline confirm delete.
    const deleteButtons = await screen.findAllByText('Borrar');
    await user.click(deleteButtons[0]); // AAPL sell (id 2)
    const prompt = await screen.findByRole('alert');
    expect(prompt).toHaveTextContent('¿Borrar la operación?');
    await user.click(within(prompt).getByRole('button', { name: 'Borrar' }));
    await vi.waitFor(() => expect(del).toHaveBeenCalledWith(2));
  });

  it('auto-refreshes non-forced every 5 min while visible and pauses when hidden (PI-5)', async () => {
    mockPortfolioAndTrades();
    const refresh = vi.spyOn(api, 'refreshPortfolio').mockResolvedValue({ results: [] });
    const visibility = { hidden: false };
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visibility.hidden ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => visibility.hidden });

    vi.useFakeTimers();
    render(<InvestmentsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.getPortfolio).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });
    expect(refresh).toHaveBeenCalledWith(false);

    visibility.hidden = true;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * FIVE_MINUTES);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    visibility.hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('manual refresh forces the server refresh and reloads the summary', async () => {
    mockPortfolioAndTrades();
    vi.spyOn(api, 'refreshPortfolio').mockResolvedValue({ results: [] });
    const user = userEvent.setup();

    render(<InvestmentsPage />);
    await screen.findByTestId('positions-table');

    await user.click(screen.getByTestId('portfolio-refresh'));

    expect(api.refreshPortfolio).toHaveBeenCalledWith(true);
    await vi.waitFor(() => expect(api.getPortfolio).toHaveBeenCalledTimes(2));
  });
});

describe('Price charts (PC-5, PC-6)', () => {
  const points = [
    { date: '2026-08-06', valueMinor: 158493 },
    { date: '2026-08-07', valueMinor: 160000 },
  ];

  function mockCharts(): void {
    mockPortfolioAndTrades();
    vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history(points));
  }

  it('renders the portfolio chart with an ink data line and the always-visible honesty note', async () => {
    mockCharts();

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('portfolio-chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-honesty-note')).toHaveTextContent('Valores con cantidades actuales');
    await vi.waitFor(() => {
      const line = document.querySelector('.recharts-line path');
      expect(line).not.toBeNull();
      expect(line).toHaveAttribute('stroke', '#1a1815');
    });
  });

  it('shows es-AR tabular values in the chart tooltip', async () => {
    mockCharts();

    render(<InvestmentsPage />);
    await screen.findByTestId('portfolio-chart');
    await vi.waitFor(() => expect(document.querySelector('.recharts-surface')).not.toBeNull());

    fireEvent.mouseMove(document.querySelector('.recharts-surface') as Element, { clientX: 300, clientY: 60 });

    const tooltip = await screen.findByTestId('chart-tooltip-value');
    expect(tooltip.textContent).toMatch(/\d{1,3}(\.\d{3})*(,\d+)?/);
  });

  it('formats es-AR currency figures with thousands separators', () => {
    // Intl separates the symbol and the figure with a non-breaking space.
    expect(formatChartMoney(158493, 'ARS')).toBe('$\u00A01.584,93');
    expect(formatChartMoney(158493, 'USD')).toBe('US$\u00A01.584,93');
  });

  it('re-fetches when a range chip or the currency toggle changes', async () => {
    mockCharts();
    const getHistory = vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history(points));
    const user = userEvent.setup();

    render(<InvestmentsPage />);
    await screen.findByTestId('portfolio-chart');

    await user.click(screen.getByTestId('chip-1m'));
    expect(getHistory).toHaveBeenCalledWith('1m', 'ARS');
    expect(screen.getByTestId('chip-1m')).toHaveClass('active');

    await user.click(screen.getByTestId('chip-6m'));
    expect(getHistory).toHaveBeenCalledWith('6m', 'ARS');
    expect(screen.getByTestId('chip-6m')).toHaveClass('active');

    await user.click(screen.getByTestId('currency-usd'));
    expect(getHistory).toHaveBeenCalledWith('6m', 'USD');
    expect(screen.getByTestId('currency-usd')).toHaveClass('active');
  });

  it('forces one fetch for the newly selected pair the first time the currency toggle lands on it', async () => {
    mockCharts();
    const getHistory = vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history(points));
    const user = userEvent.setup();

    render(<InvestmentsPage />);
    await screen.findByTestId('portfolio-chart');

    const usdForceCalls = (): number =>
      getHistory.mock.calls.filter(([r, c, force]) => r === '3m' && c === 'USD' && force === true).length;
    expect(usdForceCalls()).toBe(1); // warm-up

    await user.click(screen.getByTestId('currency-usd'));
    expect(getHistory).toHaveBeenCalledWith('3m', 'USD', true);
    expect(usdForceCalls()).toBe(2); // warm-up + first toggle

    await user.click(screen.getByTestId('currency-ars'));
    await user.click(screen.getByTestId('currency-usd'));
    expect(usdForceCalls()).toBe(2); // same pair: never re-forced
  });

  it('shows the degradation note when history degrades to another currency', async () => {
    mockPortfolioAndTrades();
    vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue({ ...history(points), degraded: true, currency: 'ARS' });

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('chart-degraded-note')).toHaveTextContent(
      'Cotización CCL no disponible — mostrando ARS.',
    );
  });

  it('shows the degradation note on the per-asset chart too', async () => {
    mockCharts();
    vi.spyOn(api, 'getPositionHistory').mockResolvedValue({ ...history(points), degraded: true, currency: 'ARS' });
    const user = userEvent.setup();

    render(<InvestmentsPage />);
    await screen.findByTestId('positions-table');

    await user.click(screen.getByTestId('position-1'));
    expect(await screen.findByTestId('asset-chart-degraded-note-1')).toHaveTextContent(
      'Cotización CCL no disponible — mostrando ARS.',
    );
  });

  it('shows the empty state when there are no points', async () => {
    mockPortfolioAndTrades();
    vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history([]));

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('chart-empty')).toBeInTheDocument();
  });

  it('shows a chart error with Reintentar that reloads', async () => {
    mockPortfolioAndTrades();
    const getHistory = vi.spyOn(api, 'getPortfolioHistory').mockRejectedValue(new Error('sin datos'));
    const user = userEvent.setup();

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('chart-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-chart'));
    await vi.waitFor(() => expect(getHistory).toHaveBeenCalledTimes(10)); // 8 warm-up + 1 mount + 1 retry
  });

  it('expands one inline asset chart per tapped row, swapping on the next tap', async () => {
    mockCharts();
    vi.spyOn(api, 'getPositionHistory').mockResolvedValue(history(points));
    const user = userEvent.setup();

    render(<InvestmentsPage />);
    await screen.findByTestId('positions-table');

    await user.click(screen.getByTestId('position-1'));
    expect(await screen.findByTestId('asset-chart-1')).toBeInTheDocument();
    expect(screen.getByTestId('position-1')).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByTestId('position-2'));
    expect(await screen.findByTestId('asset-chart-2')).toBeInTheDocument();
    expect(screen.queryByTestId('asset-chart-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('position-1')).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByTestId('position-2'));
    expect(screen.queryByTestId('asset-chart-2')).not.toBeInTheDocument();
  });

  it('warms the series cache once per range on open and on visibilitychange back to visible', async () => {
    mockCharts();
    const getHistory = vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history(points));
    const visibility = { hidden: false };
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visibility.hidden ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => visibility.hidden });

    render(<InvestmentsPage />);
    await screen.findByTestId('portfolio-chart');

    const forcedCalls = (): number =>
      getHistory.mock.calls.filter(([, , force]) => force === true).length;
    expect(getHistory).toHaveBeenCalledWith('1m', 'ARS', true);
    expect(getHistory).toHaveBeenCalledWith('1m', 'USD', true);
    expect(getHistory).toHaveBeenCalledWith('3m', 'ARS', true);
    expect(getHistory).toHaveBeenCalledWith('3m', 'USD', true);
    expect(getHistory).toHaveBeenCalledWith('6m', 'ARS', true);
    expect(getHistory).toHaveBeenCalledWith('6m', 'USD', true);
    expect(getHistory).toHaveBeenCalledWith('1y', 'ARS', true);
    expect(getHistory).toHaveBeenCalledWith('1y', 'USD', true);
    expect(forcedCalls()).toBe(8);

    visibility.hidden = true;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(forcedCalls()).toBe(8); // hidden: no warm-up

    visibility.hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(forcedCalls()).toBe(16); // visible again: one force per range and currency
  });
});
