import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ApiError, api, setUnauthorizedHandler } from './api';
import type { BudgetStatus, PeriodSummary } from './types';

const budgetStatus: BudgetStatus = {
  month: '2026-08',
  categories: [],
  global: { cap: 0, consumed: 0, overBudget: false },
};

const emptySummary: PeriodSummary = { period: 'month', currencies: [], categories: [] };

function mockAllApis(): void {
  vi.spyOn(api, 'authStatus').mockResolvedValue(true);
  vi.spyOn(api, 'login').mockResolvedValue(undefined);
  vi.spyOn(api, 'logout').mockResolvedValue(undefined);
  vi.spyOn(api, 'listTransactions').mockResolvedValue([]);
  vi.spyOn(api, 'getCategoryTree').mockResolvedValue([]);
  vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);
  vi.spyOn(api, 'getBudgets').mockResolvedValue({});
  vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(budgetStatus);
  vi.spyOn(api, 'getSummary').mockResolvedValue(emptySummary);
  vi.spyOn(api, 'getIndicators').mockResolvedValue([]);
  vi.spyOn(api, 'getPortfolio').mockResolvedValue({ ccStatus: 'absent', totals: { valueUsdMinor: 0, valueArsMinor: null, pnlUsdMinor: 0, pnlPct: null, pnlArsMinor: null, realizedUsdMinor: 0 }, positions: [] });
  vi.spyOn(api, 'listTrades').mockResolvedValue([]);
}

describe('App tab switching', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps every page mounted and hides inactive tabs with CSS (state survives switches)', async () => {
    mockAllApis();
    const user = userEvent.setup();
    render(<App />);

    const note = await screen.findByTestId('note');
    await user.type(note, 'rent');

    await user.click(screen.getByRole('tab', { name: 'Categorías' }));

    // The transaction form is still in the DOM, just hidden (no unmount).
    expect(document.querySelector('[data-testid="note"]')).not.toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Transacciones' }));

    expect(screen.getByTestId('note')).toHaveValue('rent');
  });

  it('switches to every tab and back without crashing', async () => {
    mockAllApis();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByTestId('note');

    for (const tab of ['Categorías', 'Presupuestos', 'Resúmenes', 'Indicadores', 'Transacciones']) {
      await user.click(screen.getByRole('tab', { name: tab }));
    }

    expect(screen.getByTestId('note')).toBeInTheDocument();
  });

  it('exposes the navs as tablists with role=tab and aria-selected on each tab (P3 #14)', async () => {
    mockAllApis();
    render(<App />);
    await screen.findByTestId('note');

    // The desktop tablist is visible to the a11y tree; the mobile bottom bar
    // carries the same roles but is display:none at desktop widths.
    expect(screen.getByRole('tablist', { name: 'Secciones' })).toBeInTheDocument();
    expect(document.querySelector('.bottom-bar')?.getAttribute('role')).toBe('tablist');
    expect(document.querySelector('.desktop-tabs')?.getAttribute('role')).toBe('tablist');

    const transactionsTab = screen.getByRole('tab', { name: 'Transacciones' });
    const categoriesTab = screen.getByRole('tab', { name: 'Categorías' });
    expect(transactionsTab).toHaveAttribute('aria-selected', 'true');
    expect(categoriesTab).toHaveAttribute('aria-selected', 'false');

    const user = userEvent.setup();
    await user.click(categoriesTab);
    expect(categoriesTab).toHaveAttribute('aria-selected', 'true');
    expect(transactionsTab).toHaveAttribute('aria-selected', 'false');
  });

  it('switches tabs from the mobile bottom bar, sharing state with the header tabs', async () => {
    mockAllApis();
    render(<App />);
    await screen.findByTestId('note');

    const bottomBar = document.querySelector('.bottom-bar');
    expect(bottomBar).not.toBeNull();

    const indicatorsButton = Array.from(bottomBar!.querySelectorAll('button')).find((b) => b.textContent === 'Indicadores');
    expect(indicatorsButton).toBeDefined();
    fireEvent.click(indicatorsButton!);
    const clickedIndicator = indicatorsButton!;

    // The Indicators panel is now the visible one.
    const visiblePanel = Array.from(document.querySelectorAll('.tab-panel')).find((p) => !p.classList.contains('hidden'));
    expect(visiblePanel?.textContent).toContain('Argentina — Indicadores económicos');

    // The same state drives the desktop header tabs.
    const desktopButton = Array.from(document.querySelectorAll('nav.tabs.desktop-tabs button')).find((b) => b.textContent === 'Indicadores');
    expect(desktopButton?.classList.contains('active')).toBe(true);
    expect(clickedIndicator.classList.contains('active')).toBe(true);
  });
});

describe('App auth gate (WU2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows a minimal loading card while the session is being checked', () => {
    vi.spyOn(api, 'authStatus').mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByTestId('auth-loading')).toHaveTextContent('Cargando…');
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  });

  it('shows the login gate when unauthenticated', async () => {
    vi.spyOn(api, 'authStatus').mockResolvedValue(false);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.queryByTestId('note')).not.toBeInTheDocument();
  });

  it('shows the app shell when authenticated', async () => {
    mockAllApis();
    render(<App />);
    expect(await screen.findByTestId('note')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ingresar' })).not.toBeInTheDocument();
  });

  it('flips to the app after a successful login', async () => {
    mockAllApis();
    vi.spyOn(api, 'authStatus').mockResolvedValue(false);
    const login = vi.spyOn(api, 'login').mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('Contraseña'), 'clave-secreta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByTestId('note')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('clave-secreta', false);
  });

  it('returns to the login gate after logout', async () => {
    mockAllApis();
    const logout = vi.spyOn(api, 'logout').mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByTestId('note');

    await user.click(screen.getByRole('button', { name: 'Salir' }));

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('drops back to the login gate when a page call receives 401 (session expired)', async () => {
    vi.spyOn(api, 'authStatus').mockResolvedValue(true);
    const unauthorized = {
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
    } as unknown as Response;
    const fetchMock = vi.fn(async () => unauthorized);
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('unauthorized handler (WU2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setUnauthorizedHandler(null);
  });

  it('fires on a 401 UNAUTHORIZED data call but never on login or status', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const unauthorized = {
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn(async () => unauthorized));

    await expect(api.listTransactions()).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);

    // The auth flow itself must not bounce back to the gate.
    await expect(api.login('clave', false)).rejects.toBeInstanceOf(ApiError);
    await expect(api.authStatus()).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
