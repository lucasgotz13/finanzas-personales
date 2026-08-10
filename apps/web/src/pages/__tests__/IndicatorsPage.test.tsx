import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import type { IndicatorView } from '../../types';
import IndicatorsPage from '../IndicatorsPage';

const FIVE_MINUTES = 5 * 60_000;

function freshViews(overrides: Partial<IndicatorView>[] = []): IndicatorView[] {
  const base: Array<[string, number, string, string]> = [
    ['usd-blue', 1350.5, 'ARS/USD', 'USD Blue'],
    ['usd-oficial', 1200, 'ARS/USD', 'USD Oficial'],
    ['usd-tarjeta', 1560, 'ARS/USD', 'USD Tarjeta'],
    ['usd-mep', 1330, 'ARS/USD', 'USD MEP'],
    ['usd-ccl', 1345, 'ARS/USD', 'USD CCL'],
    ['riesgo-pais', 1050, 'pb', 'Riesgo País'],
    ['ipc-mensual', -0.1, '%', 'IPC Mensual'],
    ['reservas', 28000, 'millones USD', 'Reservas'],
    ['badlar', 38.5, '% TNA', 'BADLAR'],
  ];
  return base.map(([key, value, unit], i) => ({
    key,
    value,
    unit,
    referenceDate: '2026-08-09',
    updatedAt: new Date().toISOString(),
    stale: false,
    status: 'fresh',
    referenceAged: false,
    ...overrides[i],
  }));
}

describe('IndicatorsPage (EI-6)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders 9 cards with label, value, unit and updatedAt, no badge', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());

    render(<IndicatorsPage />);

    expect(await screen.findByTestId('indicators-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^indicator-/)).toHaveLength(9);
    expect(screen.getByText('USD Blue')).toBeInTheDocument();
    expect(screen.getByText('1350.5')).toBeInTheDocument();
    expect(screen.getAllByText('ARS/USD')).toHaveLength(5);
    expect(screen.getByText('-0.1')).toBeInTheDocument();
    expect(screen.queryByText('STALE')).not.toBeInTheDocument();
  });

  it('renders the reference date on every card and no OLD REFERENCE when fresh (issue #29)', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());

    render(<IndicatorsPage />);
    await screen.findByTestId('indicators-grid');

    expect(screen.getAllByText('ref 2026-08')).toHaveLength(9);
    expect(screen.queryByText('OLD REFERENCE')).not.toBeInTheDocument();
  });

  it('shows the OLD REFERENCE badge when aged while the fetch status stays fresh (issue #29)', async () => {
    const views = freshViews();
    views[6] = { ...views[6], referenceAged: true }; // ipc-mensual
    vi.spyOn(api, 'getIndicators').mockResolvedValue(views);

    render(<IndicatorsPage />);
    await screen.findByTestId('indicators-grid');

    expect(screen.getByTestId('indicator-ipc-mensual')).toHaveTextContent('OLD REFERENCE');
    expect(screen.queryByText('STALE')).not.toBeInTheDocument();
    expect(screen.getAllByText('ref 2026-08')).toHaveLength(9);
  });

  it('shows a loading state before data arrives', () => {
    vi.spyOn(api, 'getIndicators').mockReturnValue(new Promise(() => {}));

    render(<IndicatorsPage />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('keeps rendering stale values with the badge when auto-refresh fails', async () => {
    const views = freshViews();
    views[0] = {
      ...views[0],
      stale: true,
      status: 'stale',
      updatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    };
    vi.spyOn(api, 'getIndicators').mockResolvedValue(views);
    vi.spyOn(api, 'refreshIndicators').mockRejectedValue(new Error('sources down'));

    vi.useFakeTimers();
    render(<IndicatorsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('STALE')).toBeInTheDocument();
    expect(screen.getByText('1350.5')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });

    expect(api.refreshIndicators).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('refresh-error')).toHaveTextContent('sources down');
    expect(screen.getByText('STALE')).toBeInTheDocument();
  });

  it('manual refresh forces the server refresh and reloads the views', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());
    vi.spyOn(api, 'refreshIndicators').mockResolvedValue({ results: [] });
    const user = userEvent.setup();

    render(<IndicatorsPage />);
    await screen.findByTestId('indicators-grid');

    await user.click(screen.getByTestId('indicators-refresh'));

    expect(api.refreshIndicators).toHaveBeenCalledWith(true);
    await vi.waitFor(() => expect(api.getIndicators).toHaveBeenCalledTimes(2));
  });

  it('auto-refreshes non-forced every 5 minutes while mounted', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());
    vi.spyOn(api, 'refreshIndicators').mockResolvedValue({ results: [] });

    vi.useFakeTimers();
    render(<IndicatorsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.getIndicators).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });

    expect(api.refreshIndicators).toHaveBeenCalledWith(false);
    expect(api.getIndicators).toHaveBeenCalledTimes(2);
  });

  it('cleans up the auto-refresh interval on unmount', () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());
    vi.spyOn(api, 'refreshIndicators').mockResolvedValue({ results: [] });
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = render(<IndicatorsPage />);
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
