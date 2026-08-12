import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { formatChartMoney } from '../../components/SeriesChart';
import type { HistoryResponse, PortfolioSummary } from '../../types';
import InvestmentsPage from '../InvestmentsPage';

const FIVE_MINUTES = 5 * 60_000;

function history(points: Array<{ date: string; valueMinor: number }> = []): HistoryResponse {
  return { points, currency: 'ARS', range: '3m', status: 'fresh' };
}

function summary(): PortfolioSummary {
  return {
    ccStatus: 'fresh',
    totals: { valueUsdMinor: 200000, valueArsMinor: 269000000, pnlUsdMinor: 20000, pnlPct: 0.1111, pnlArsMinor: 26900000 },
    positions: [
      { id: 1, ticker: 'AAPL.BA', name: 'Apple', quantity: 10, avgCostMinor: 18000, priceMinor: 20000, status: 'fresh', valueUsdMinor: 200000, valueArsMinor: 269000000, pnlUsdMinor: 20000, pnlPct: 0.1111, pnlArsMinor: 26900000 },
      { id: 2, ticker: 'GGAL.BA', name: 'Galicia', quantity: 5, avgCostMinor: 6000, priceMinor: null, status: 'absent', valueUsdMinor: null, valueArsMinor: null, pnlUsdMinor: null, pnlPct: null, pnlArsMinor: null },
    ],
  };
}

describe('InvestmentsPage (PI-6)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (document as { visibilityState?: unknown }).visibilityState;
    delete (document as { hidden?: unknown }).hidden;
  });

  it('renders the positions table with freshness chips and the money-first summary', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('positions-table')).toBeInTheDocument();
    expect(screen.getByTestId('position-1')).toHaveTextContent('Apple');
    expect(screen.getByTestId('position-1')).toHaveTextContent('Al día');
    expect(screen.getByTestId('position-2')).toHaveTextContent('Sin precio');
    expect(screen.getByTestId('portfolio-summary')).toHaveTextContent('ARS (CCL)');
    expect(screen.getByTestId('portfolio-summary')).toHaveTextContent('2.690.000,00');
    expect(screen.getByTestId('portfolio-summary')).toHaveTextContent('2.000,00');
    expect(screen.getByTestId('portfolio-summary')).toHaveTextContent('+11,11%');
  });

  it('shows the empty state when there are no positions', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue({ ccStatus: 'absent', totals: { valueUsdMinor: 0, valueArsMinor: null, pnlUsdMinor: 0, pnlPct: null, pnlArsMinor: null }, positions: [] });

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('portfolio-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('positions-table')).not.toBeInTheDocument();
  });

  it('shows the fetch error in a role=alert box and Reintentar reloads', async () => {
    const getPortfolio = vi.spyOn(api, 'getPortfolio').mockRejectedValue(new Error('api caída'));
    const user = userEvent.setup();

    render(<InvestmentsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('api caída');
    await user.click(screen.getByTestId('retry-portfolio'));
    await vi.waitFor(() => expect(getPortfolio).toHaveBeenCalledTimes(2));
  });

  it('auto-refreshes non-forced every 5 min while visible and pauses when hidden (PI-5)', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
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
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    vi.spyOn(api, 'refreshPortfolio').mockResolvedValue({ results: [] });
    const user = userEvent.setup();

    render(<InvestmentsPage />);
    await screen.findByTestId('positions-table');

    await user.click(screen.getByTestId('portfolio-refresh'));

    expect(api.refreshPortfolio).toHaveBeenCalledWith(true);
    await vi.waitFor(() => expect(api.getPortfolio).toHaveBeenCalledTimes(2));
  });

  it('creates a position through the form and deletes one after confirmation', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    const create = vi.spyOn(api, 'createPosition').mockResolvedValue({ id: 3, ticker: 'MELI.BA', name: 'MELI.BA', quantity: 2, avgCostMinor: 1000, currency: 'USD', createdAt: new Date().toISOString() });
    const del = vi.spyOn(api, 'deletePosition').mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<InvestmentsPage />);
    await screen.findByTestId('positions-table');

    await user.type(screen.getByTestId('ticker'), 'meli');
    await user.type(screen.getByTestId('quantity'), '2');
    await user.type(screen.getByTestId('avg-cost'), '10');
    await user.click(screen.getByTestId('submit'));
    expect(create).toHaveBeenCalledWith({ ticker: 'meli', quantity: 2, avgCostMinor: 1000 });

    await user.click(screen.getAllByText('Borrar')[0]);
    const prompt = await screen.findByRole('alert');
    expect(prompt).toHaveTextContent('¿Borrar la posición?');
    await user.click(within(prompt).getByRole('button', { name: 'Borrar' }));
    await vi.waitFor(() => expect(del).toHaveBeenCalledWith(1));
  });
});

describe('Price charts (PC-5, PC-6)', () => {
  const points = [
    { date: '2026-08-06', valueMinor: 158493 },
    { date: '2026-08-07', valueMinor: 160000 },
  ];

  it('renders the portfolio chart with an ink data line and the always-visible honesty note', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history(points));

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
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history(points));

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
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    const getHistory = vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history(points));
    const user = userEvent.setup();

    render(<InvestmentsPage />);
    await screen.findByTestId('portfolio-chart');

    await user.click(screen.getByTestId('chip-6m'));
    expect(getHistory).toHaveBeenCalledWith('6m', 'ARS');
    expect(screen.getByTestId('chip-6m')).toHaveClass('active');

    await user.click(screen.getByTestId('currency-usd'));
    expect(getHistory).toHaveBeenCalledWith('6m', 'USD');
    expect(screen.getByTestId('currency-usd')).toHaveClass('active');
  });

  it('shows the empty state when there are no points', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history([]));

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('chart-empty')).toBeInTheDocument();
  });

  it('shows a chart error with Reintentar that reloads', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    const getHistory = vi.spyOn(api, 'getPortfolioHistory').mockRejectedValue(new Error('sin datos'));
    const user = userEvent.setup();

    render(<InvestmentsPage />);

    expect(await screen.findByTestId('chart-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-chart'));
    await vi.waitFor(() => expect(getHistory).toHaveBeenCalledTimes(5)); // 3 warm-up + 1 mount + 1 retry
  });

  it('expands one inline asset chart per tapped row, swapping on the next tap', async () => {
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history(points));
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
    vi.spyOn(api, 'getPortfolio').mockResolvedValue(summary());
    const getHistory = vi.spyOn(api, 'getPortfolioHistory').mockResolvedValue(history(points));
    const visibility = { hidden: false };
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visibility.hidden ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => visibility.hidden });

    render(<InvestmentsPage />);
    await screen.findByTestId('portfolio-chart');

    const forcedCalls = (): number =>
      getHistory.mock.calls.filter(([, , force]) => force === true).length;
    expect(getHistory).toHaveBeenCalledWith('3m', 'ARS', true);
    expect(getHistory).toHaveBeenCalledWith('6m', 'ARS', true);
    expect(getHistory).toHaveBeenCalledWith('1y', 'ARS', true);
    expect(forcedCalls()).toBe(3);

    visibility.hidden = true;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(forcedCalls()).toBe(3); // hidden: no warm-up

    visibility.hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(forcedCalls()).toBe(6); // visible again: one force per range
  });
});
