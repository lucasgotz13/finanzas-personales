import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import type { IndicatorView } from '../../types';
import IndicatorsPage from '../IndicatorsPage';

const FIVE_MINUTES = 5 * 60_000;

function freshViews(overrides: Partial<IndicatorView>[] = []): IndicatorView[] {
  const base: Array<[string, number, string, IndicatorView['group']]> = [
    ['usd-blue', 1350.5, 'ARS/USD', 'mercado'],
    ['usd-oficial', 1200, 'ARS/USD', 'mercado'],
    ['usd-tarjeta', 1560, 'ARS/USD', 'mercado'],
    ['usd-mep', 1330, 'ARS/USD', 'mercado'],
    ['usd-ccl', 1345, 'ARS/USD', 'mercado'],
    ['riesgo-pais', 1050, 'pb', 'mercado'],
    ['ipc-mensual', -0.1, '%', 'economia'],
    ['reservas', 28000, 'millones USD', 'mercado'],
    ['badlar', 38.5, '% TNA', 'mercado'],
    ['brent', 67.45, 'USD/bbl', 'mercado'],
    ['wti', 63.2, 'USD/bbl', 'mercado'],
    ['ipc-interanual', 33.4, '%', 'economia'],
    ['canasta-basica-total', 528318.67, 'ARS', 'economia'],
    ['salarios-variacion', 35.61, '%', 'economia'],
    ['emae-variacion', -1.74, '%', 'economia'],
  ];
  return base.map(([key, value, unit, group], i) => ({
    key,
    group,
    value,
    unit,
    referenceDate: '2026-08-09',
    updatedAt: new Date().toISOString(),
    stale: false,
    status: 'fresh',
    referenceAged: false,
    changePercent: null,
    ...overrides[i],
  }));
}

describe('IndicatorsPage (EI-6)', () => {
  afterEach(() => {
    // Real timers FIRST: restoring them before restoreAllMocks avoids a
    // descriptor conflict with the clearInterval spy (fake timers + spy).
    vi.useRealTimers();
    vi.restoreAllMocks();
    // Restore the visibilityState/hidden overrides installed by the polling-gate test.
    delete (document as { visibilityState?: unknown }).visibilityState;
    delete (document as { hidden?: unknown }).hidden;
  });

  it('renders 15 cards with label, value, unit and updatedAt, no badge', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());

    render(<IndicatorsPage />);

    expect(await screen.findByTestId('indicators-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^indicator-(?!group-)/)).toHaveLength(15);
    expect(screen.getByText('USD Blue')).toBeInTheDocument();
    expect(screen.getByText('1.350,5')).toBeInTheDocument();
    expect(screen.getAllByText('ARS/USD')).toHaveLength(5);
    expect(screen.getByText('-0,1')).toBeInTheDocument();
    // Brent/WTI are proper nouns: no translation in the label map.
    expect(screen.getByText('Brent')).toBeInTheDocument();
    expect(screen.getByText('WTI')).toBeInTheDocument();
    expect(screen.getByText('67,45')).toBeInTheDocument();
    // Economy cards carry their own Spanish labels and units.
    expect(screen.getByText('Canasta Básica Total')).toBeInTheDocument();
    expect(screen.getByText('528.318,67')).toBeInTheDocument();
    expect(screen.getByText('ARS')).toBeInTheDocument();
    expect(screen.getByText('IPC Interanual')).toBeInTheDocument();
    expect(screen.queryByText('Vencido')).not.toBeInTheDocument();
  });

  it('splits the cards into the Mercado and Economía argentina subsections (EI-6)', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());

    render(<IndicatorsPage />);
    await screen.findByTestId('indicators-grid');

    const market = screen.getByTestId('indicator-group-mercado');
    const economy = screen.getByTestId('indicator-group-economia');
    expect(market).toHaveTextContent('Mercado');
    expect(economy).toHaveTextContent('Economía argentina');
    expect(market.querySelectorAll('.indicator-card')).toHaveLength(10);
    expect(economy.querySelectorAll('.indicator-card')).toHaveLength(5);
    // Market renders before economy.
    expect(market.compareDocumentPosition(economy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the reference date on every card and no Referencia antigua when fresh (issue #29)', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());

    render(<IndicatorsPage />);
    await screen.findByTestId('indicators-grid');

    expect(screen.getAllByText('ref ago 2026')).toHaveLength(15);
    expect(screen.queryByText('Referencia antigua')).not.toBeInTheDocument();
  });

  it('shows the Referencia antigua badge when aged while the fetch status stays fresh (issue #29)', async () => {
    const views = freshViews();
    views[6] = { ...views[6], referenceAged: true }; // ipc-mensual
    vi.spyOn(api, 'getIndicators').mockResolvedValue(views);

    render(<IndicatorsPage />);
    await screen.findByTestId('indicators-grid');

    expect(screen.getByTestId('indicator-ipc-mensual')).toHaveTextContent('Referencia antigua');
    expect(screen.queryByText('Vencido')).not.toBeInTheDocument();
    expect(screen.getAllByText('ref ago 2026')).toHaveLength(15);
  });

  it('shows a loading state before data arrives', () => {
    vi.spyOn(api, 'getIndicators').mockReturnValue(new Promise(() => {}));

    render(<IndicatorsPage />);

    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('shows an empty state when the API returns no indicators', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue([]);

    render(<IndicatorsPage />);

    expect(await screen.findByText('Aún no hay indicadores — presione Refrescar.')).toBeInTheDocument();
    expect(screen.queryByTestId('indicators-grid')).not.toBeInTheDocument();
  });

  it('keeps the grid visible during auto-refresh (no Cargando… collapse)', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());
    vi.spyOn(api, 'refreshIndicators').mockResolvedValue({ results: [] });

    vi.useFakeTimers();
    render(<IndicatorsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('indicators-grid')).toBeInTheDocument();

    // Reload keeps loading=true briefly; the stale grid must stay put.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });

    expect(screen.getByTestId('indicators-grid')).toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
    expect(api.refreshIndicators).toHaveBeenCalledWith(false);
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

    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText('1.350,5')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });

    expect(api.refreshIndicators).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('refresh-error')).toHaveTextContent('sources down');
    expect(screen.getByText('Vencido')).toBeInTheDocument();
  });

  it('manual refresh forces the server refresh and reloads the views', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());
    vi.spyOn(api, 'refreshIndicators').mockResolvedValue({ results: [] });
    const user = userEvent.setup();

    render(<IndicatorsPage />);
    await screen.findByTestId('indicators-grid');

    await user.click(screen.getByTestId('indicators-refresh'));

    expect(api.refreshIndicators).toHaveBeenCalledWith(true);
    await vi.waitFor(() => expect(api.getIndicators).toHaveBeenCalledTimes(3));
  });

  it('surfaces the refresh error in a role=alert box (P2)', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());
    vi.spyOn(api, 'refreshIndicators').mockRejectedValue(new Error('fuente caída'));
    const user = userEvent.setup();

    render(<IndicatorsPage />);
    await screen.findByTestId('indicators-grid');

    await user.click(screen.getByTestId('indicators-refresh'));

    expect(await screen.findByRole('alert')).toHaveTextContent('fuente caída');
  });

  it('auto-refreshes non-forced every 5 minutes while mounted', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());
    vi.spyOn(api, 'refreshIndicators').mockResolvedValue({ results: [] });

    vi.useFakeTimers();
    render(<IndicatorsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Entry tick: one non-forced refresh on mount/entry, then the views reload.
    expect(api.refreshIndicators).toHaveBeenCalledTimes(1);
    expect(api.refreshIndicators).toHaveBeenCalledWith(false);
    expect(api.getIndicators).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });

    expect(api.refreshIndicators).toHaveBeenCalledWith(false);
    expect(api.refreshIndicators).toHaveBeenCalledTimes(2);
    expect(api.getIndicators).toHaveBeenCalledTimes(3);
  });

  it('cleans up the auto-refresh interval on unmount', () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());
    vi.spyOn(api, 'refreshIndicators').mockResolvedValue({ results: [] });
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = render(<IndicatorsPage />);
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });

  it('pauses the 5-min cadence while hidden and refreshes once on visibilitychange (P3 #3)', async () => {
    vi.spyOn(api, 'getIndicators').mockResolvedValue(freshViews());
    const refresh = vi.spyOn(api, 'refreshIndicators').mockResolvedValue({ results: [] });

    const visibility = { hidden: false };
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (visibility.hidden ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => visibility.hidden });

    vi.useFakeTimers();
    render(<IndicatorsPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Entry tick on mount: one non-forced refresh plus the reload.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(api.getIndicators).toHaveBeenCalledTimes(2);

    // Visible cadence: one refresh per 5 minutes.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });
    expect(refresh).toHaveBeenCalledTimes(2);

    // Tab hidden: the interval pauses.
    visibility.hidden = true;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * FIVE_MINUTES);
    });
    expect(refresh).toHaveBeenCalledTimes(2);

    // Back to visible: exactly one catch-up refresh, then the cadence resumes.
    visibility.hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(refresh).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it('shows the fetch error in a role=alert box and Reintentar reloads the views (P3 #4, #9)', async () => {
    const getIndicators = vi.spyOn(api, 'getIndicators').mockRejectedValue(new Error('panel caído'));
    vi.spyOn(api, 'refreshIndicators').mockResolvedValue({ results: [] });
    const user = userEvent.setup();

    render(<IndicatorsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('panel caído');
    await user.click(screen.getByTestId('retry-indicators'));
    await vi.waitFor(() => expect(getIndicators).toHaveBeenCalledTimes(3));
  });
});
