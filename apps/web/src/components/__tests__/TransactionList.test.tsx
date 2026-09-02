import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiTransaction } from '../../types';
import TransactionList from '../TransactionList';

const transactions: ApiTransaction[] = [
  { id: 1, direction: 'expense', amountMinor: 15000, currency: 'ARS', rate: 1, date: '2026-07-15', categoryId: 1, note: 'Lunch' },
  { id: 2, direction: 'income', amountMinor: 900000, currency: 'ARS', rate: 1, date: '2026-07-01', categoryId: 10, note: '' },
];

const baseProps = {
  categoryNames: new Map<number, string>([
    [1, 'Food'],
    [10, 'Salary'],
  ]),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  confirmingId: null,
  onConfirmDelete: vi.fn(),
  onCancelDelete: vi.fn(),
  sortResetKey: 'initial',
};

function rowNotes(): string[] {
  return within(screen.getByTestId('transaction-list'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1].textContent ?? '');
}

function amountHeader(): HTMLElement {
  return screen.getByRole('columnheader', { name: /Monto/ });
}

function sortButton(): HTMLElement {
  return screen.getByRole('button', { name: /Ordenar por equivalente ARS/ });
}

describe('TransactionList', () => {
  it('starts unsorted and preserves the incoming chronological order', () => {
    render(<TransactionList transactions={transactions} {...baseProps} />);

    expect(screen.getByRole('columnheader', { name: /Monto/ })).toHaveAttribute('aria-sort', 'none');
    const rows = within(screen.getByTestId('transaction-list')).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[1].textContent)).toEqual(['Lunch', '—']);
  });

  it('sorts mixed ARS/USD rows ascending by absolute entry-rate ARS equivalent', async () => {
    const user = userEvent.setup();
    const mixed: ApiTransaction[] = [
      { id: 1, direction: 'expense', amountMinor: 50000, currency: 'ARS', rate: 1, date: '2026-07-03', categoryId: 1, note: 'ARS 500' },
      { id: 2, direction: 'income', amountMinor: 10000, currency: 'USD', rate: 3, date: '2026-07-02', categoryId: 1, note: 'USD 300' },
      { id: 3, direction: 'expense', amountMinor: 20000, currency: 'ARS', rate: 1, date: '2026-07-01', categoryId: 1, note: 'ARS 200' },
      { id: 4, direction: 'income', amountMinor: 10000, currency: 'USD', rate: 1, date: '2026-07-04', categoryId: 1, note: 'USD 100' },
    ];
    const incomingOrder = mixed.map((tx) => tx.note);

    render(<TransactionList transactions={mixed} {...baseProps} />);
    await user.click(sortButton());

    expect(rowNotes()).toEqual(['USD 100', 'ARS 200', 'USD 300', 'ARS 500']);
    expect(mixed.map((tx) => tx.note)).toEqual(incomingOrder);
    expect(amountHeader()).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByText('Ordenado por equivalente ARS al tipo de cambio registrado (menor a mayor)')).toBeInTheDocument();
    expect(sortButton()).toHaveAccessibleName('Ordenar por equivalente ARS al tipo de cambio registrado: mayor a menor');
  });

  it('toggles to descending while keeping the metric disclosure and accessible next action', async () => {
    const user = userEvent.setup();
    const mixed: ApiTransaction[] = [
      { id: 1, direction: 'expense', amountMinor: 50000, currency: 'ARS', rate: 1, date: '2026-07-03', categoryId: 1, note: 'ARS 500' },
      { id: 2, direction: 'income', amountMinor: 10000, currency: 'USD', rate: 3, date: '2026-07-02', categoryId: 1, note: 'USD 300' },
      { id: 3, direction: 'expense', amountMinor: 20000, currency: 'ARS', rate: 1, date: '2026-07-01', categoryId: 1, note: 'ARS 200' },
      { id: 4, direction: 'income', amountMinor: 10000, currency: 'USD', rate: 1, date: '2026-07-04', categoryId: 1, note: 'USD 100' },
    ];

    render(<TransactionList transactions={mixed} {...baseProps} />);
    await user.click(sortButton());
    await user.click(sortButton());

    expect(rowNotes()).toEqual(['ARS 500', 'USD 300', 'ARS 200', 'USD 100']);
    expect(amountHeader()).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByText('Ordenado por equivalente ARS al tipo de cambio registrado (mayor a menor)')).toBeInTheDocument();
    expect(sortButton()).toHaveAccessibleName('Ordenar por equivalente ARS al tipo de cambio registrado: menor a mayor');
  });

  it('resets to the incoming order and hides sorting controls', async () => {
    const user = userEvent.setup();
    const incoming: ApiTransaction[] = [
      { id: 1, direction: 'expense', amountMinor: 50000, currency: 'ARS', rate: 1, date: '2026-07-03', categoryId: 1, note: 'ARS 500' },
      { id: 2, direction: 'income', amountMinor: 10000, currency: 'USD', rate: 1, date: '2026-07-02', categoryId: 1, note: 'USD 100' },
      { id: 3, direction: 'expense', amountMinor: 20000, currency: 'ARS', rate: 1, date: '2026-07-01', categoryId: 1, note: 'ARS 200' },
    ];

    render(<TransactionList transactions={incoming} {...baseProps} />);
    await user.click(sortButton());
    await user.click(screen.getByRole('button', { name: 'Restablecer orden' }));

    expect(amountHeader()).toHaveAttribute('aria-sort', 'none');
    expect(screen.queryByText(/Ordenado por equivalente ARS/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restablecer orden' })).not.toBeInTheDocument();
    expect(rowNotes()).toEqual(['ARS 500', 'USD 100', 'ARS 200']);
  });

  it('resolves equal ARS equivalents by date and then id in ascending order', async () => {
    const user = userEvent.setup();
    const tied: ApiTransaction[] = [
      { id: 7, direction: 'expense', amountMinor: 10000, currency: 'ARS', rate: 1, date: '2026-07-03', categoryId: 1, note: 'Tie latest' },
      { id: 9, direction: 'income', amountMinor: 20000, currency: 'ARS', rate: 1, date: '2026-07-04', categoryId: 1, note: 'Large' },
      { id: 5, direction: 'expense', amountMinor: 10000, currency: 'ARS', rate: 1, date: '2026-07-02', categoryId: 1, note: 'Tie same date high id' },
      { id: 3, direction: 'income', amountMinor: 10000, currency: 'ARS', rate: 1, date: '2026-07-02', categoryId: 1, note: 'Tie same date low id' },
    ];

    render(<TransactionList transactions={tied} {...baseProps} />);
    await user.click(sortButton());
    expect(rowNotes()).toEqual(['Tie same date low id', 'Tie same date high id', 'Tie latest', 'Large']);

    await user.click(sortButton());
    expect(rowNotes()).toEqual(['Large', 'Tie same date low id', 'Tie same date high id', 'Tie latest']);
  });

  it('sorts by magnitude without changing visible income and expense signs', async () => {
    const user = userEvent.setup();
    const signed: ApiTransaction[] = [
      { id: 1, direction: 'expense', amountMinor: 50000, currency: 'ARS', rate: 1, date: '2026-07-01', categoryId: 1, note: 'Expense' },
      { id: 2, direction: 'income', amountMinor: 10000, currency: 'ARS', rate: 1, date: '2026-07-02', categoryId: 1, note: 'Income' },
    ];

    render(<TransactionList transactions={signed} {...baseProps} />);
    await user.click(sortButton());

    const rows = within(screen.getByTestId('transaction-list')).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Income')).toHaveTextContent('Income');
    expect(rows[0]).toHaveTextContent('+');
    expect(within(rows[1]).getByText('Expense')).toHaveTextContent('Expense');
    expect(rows[1]).toHaveTextContent('−');
  });

  it('keeps the amount header and row actions accessible after sorting', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const mixed: ApiTransaction[] = [
      { id: 1, direction: 'expense', amountMinor: 50000, currency: 'ARS', rate: 1, date: '2026-07-03', categoryId: 1, note: 'Large' },
      { id: 2, direction: 'income', amountMinor: 10000, currency: 'USD', rate: 1, date: '2026-07-02', categoryId: 1, note: 'Small' },
    ];

    render(<TransactionList transactions={mixed} {...baseProps} onEdit={onEdit} onDelete={onDelete} />);
    expect(within(amountHeader()).getAllByRole('button')).toHaveLength(1);
    expect(sortButton()).toHaveAttribute('type', 'button');
    expect(screen.getByText('↕')).toBeInTheDocument();

    await user.click(sortButton());
    const smallRow = screen.getByText('Small').closest('tr');
    expect(smallRow).not.toBeNull();
    await user.click(within(smallRow as HTMLElement).getByRole('button', { name: 'Editar' }));
    await user.click(within(smallRow as HTMLElement).getByRole('button', { name: 'Borrar' }));

    expect(onEdit).toHaveBeenCalledWith(mixed[1]);
    expect(onDelete).toHaveBeenCalledWith(mixed[1]);
  });

  it('renders rows with category names and formatted amounts', () => {
    render(<TransactionList transactions={transactions} {...baseProps} />);
    expect(screen.getByText('15/07/2026')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText(/\$\s*150,00/)).toBeInTheDocument();
    expect(screen.getByText(/\+\$\s*9\.000,00/)).toBeInTheDocument();
  });

  it('renders dates in es-AR format (dd/mm/yyyy)', () => {
    render(<TransactionList transactions={transactions} {...baseProps} />);
    expect(screen.getByText('15/07/2026')).toBeInTheDocument();
    expect(screen.getByText('01/07/2026')).toBeInTheDocument();
    expect(screen.queryByText('2026-07-15')).not.toBeInTheDocument();
  });

  it('renders the Tipo column with Gasto/Ingreso', () => {
    render(<TransactionList transactions={transactions} {...baseProps} />);
    expect(screen.getByText('Gasto')).toBeInTheDocument();
    expect(screen.getByText('Ingreso')).toBeInTheDocument();
  });

  it('shows the FX-at-entry in the rate column for USD rows and a dash for ARS rows', () => {
    const mixed: ApiTransaction[] = [
      transactions[0],
      { id: 3, direction: 'expense', amountMinor: 50000, currency: 'USD', rate: 950, date: '2026-07-10', categoryId: 1, note: 'Airbnb' },
    ];
    render(<TransactionList transactions={mixed} {...baseProps} />);
    expect(screen.getByText('Tipo de cambio')).toBeInTheDocument();
    expect(screen.getByText('950')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders an empty state when there are no transactions', () => {
    render(<TransactionList transactions={[]} {...baseProps} />);
    expect(screen.getByText(/Aún no hay transacciones/)).toBeInTheDocument();
  });

  it('falls back to the category id when the name is unknown', () => {
    render(<TransactionList transactions={[transactions[0]]} {...baseProps} categoryNames={new Map()} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('calls onEdit and onDelete with the row transaction', async () => {
    const user = userEvent.setup();
    render(<TransactionList transactions={transactions} {...baseProps} />);

    const lunchRow = screen.getByText('Lunch').closest('tr');
    const salaryRow = screen.getByText('01/07/2026').closest('tr');
    expect(lunchRow).not.toBeNull();
    expect(salaryRow).not.toBeNull();

    await user.click(within(lunchRow as HTMLElement).getByRole('button', { name: 'Editar' }));
    expect(baseProps.onEdit).toHaveBeenCalledWith(transactions[0]);

    await user.click(within(salaryRow as HTMLElement).getByRole('button', { name: 'Borrar' }));
    expect(baseProps.onDelete).toHaveBeenCalledWith(transactions[1]);
  });

  it('replaces the Borrar button with an inline confirm for the confirming row', async () => {
    const user = userEvent.setup();
    render(<TransactionList transactions={transactions} {...baseProps} confirmingId={1} />);

    expect(screen.getByText('¿Borrar la transacción?')).toBeInTheDocument();
    expect(screen.getByText('Se eliminará de presupuestos y resúmenes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Borrar' })[0]);
    expect(baseProps.onConfirmDelete).toHaveBeenCalledTimes(1);
    expect(baseProps.onDelete).not.toHaveBeenCalledWith(transactions[0]);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(baseProps.onCancelDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps Borrar buttons visible on non-confirming rows', () => {
    render(<TransactionList transactions={transactions} {...baseProps} confirmingId={1} />);
    // Row 1 is the full-width confirming strip (its own Borrar); row 2 keeps
    // its own Borrar. Only non-confirming rows still have an Editar button.
    expect(screen.getAllByRole('button', { name: 'Borrar' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(1);
  });

  it('renders the confirming row as a single full-width cell outside the actions column (#115)', () => {
    render(<TransactionList transactions={transactions} {...baseProps} confirmingId={1} />);

    const prompt = screen.getByRole('alert');
    const cell = prompt.closest('td');
    expect(cell).not.toBeNull();
    expect(cell).toHaveAttribute('colSpan', '7');
    expect(cell).not.toHaveClass('actions-cell');
    expect(cell?.closest('tr')).toHaveClass('confirming-row');
    // The confirming strip replaces the whole row: no Editar inside it.
    expect(within(cell as HTMLElement).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('moves focus to the confirm Borrar when the prompt opens and back to Editar on cancel (P3 #1)', async () => {
    const user = userEvent.setup();
    const onCancelDelete = vi.fn();
    const { rerender } = render(
      <TransactionList transactions={transactions} {...baseProps} confirmingId={null} onCancelDelete={onCancelDelete} />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Borrar' })[0]);
    expect(baseProps.onDelete).toHaveBeenCalledWith(transactions[0]);

    rerender(<TransactionList transactions={transactions} {...baseProps} confirmingId={1} onCancelDelete={onCancelDelete} />);
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Borrar' })[0]);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelDelete).toHaveBeenCalledTimes(1);

    // The confirming strip replaced the row, so the Editar button only exists
    // again after the parent clears confirmingId (as TransactionsPage does).
    rerender(<TransactionList transactions={transactions} {...baseProps} confirmingId={null} onCancelDelete={onCancelDelete} />);
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Editar' })[0]);
  });
});
