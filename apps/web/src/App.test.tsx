import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { api } from './api';
import type { BudgetStatus, PeriodSummary } from './types';

const budgetStatus: BudgetStatus = {
  month: '2026-08',
  categories: [],
  global: { cap: 0, consumed: 0, overBudget: false },
};

const emptySummary: PeriodSummary = { period: 'month', currencies: [], categories: [] };

function mockAllApis(): void {
  vi.spyOn(api, 'listTransactions').mockResolvedValue([]);
  vi.spyOn(api, 'getCategoryTree').mockResolvedValue([]);
  vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);
  vi.spyOn(api, 'getBudgets').mockResolvedValue({});
  vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(budgetStatus);
  vi.spyOn(api, 'getSummary').mockResolvedValue(emptySummary);
  vi.spyOn(api, 'getIndicators').mockResolvedValue([]);
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
