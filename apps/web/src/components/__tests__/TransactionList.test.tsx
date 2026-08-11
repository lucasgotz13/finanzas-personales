import { render, screen } from '@testing-library/react';
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
};

describe('TransactionList', () => {
  it('renders rows with category names and formatted amounts', () => {
    render(<TransactionList transactions={transactions} {...baseProps} />);
    expect(screen.getByText('2026-07-15')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText(/ARS 150\.00/)).toBeInTheDocument();
    expect(screen.getByText(/ARS 9,000\.00/)).toBeInTheDocument();
  });

  it('renders an empty state when there are no transactions', () => {
    render(<TransactionList transactions={[]} {...baseProps} />);
    expect(screen.getByText(/No transactions yet/)).toBeInTheDocument();
  });

  it('falls back to the category id when the name is unknown', () => {
    render(<TransactionList transactions={[transactions[0]]} {...baseProps} categoryNames={new Map()} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('calls onEdit and onDelete with the row transaction', async () => {
    const user = userEvent.setup();
    render(<TransactionList transactions={transactions} {...baseProps} />);

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(baseProps.onEdit).toHaveBeenCalledWith(transactions[0]);

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
    expect(baseProps.onDelete).toHaveBeenCalledWith(transactions[1]);
  });

  it('replaces the Delete button with an inline confirm for the confirming row', async () => {
    const user = userEvent.setup();
    render(<TransactionList transactions={transactions} {...baseProps} confirmingId={1} />);

    expect(screen.getByText('Delete permanently?')).toBeInTheDocument();
    expect(screen.getByText('Removes it from budgets and summaries.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes' }));
    expect(baseProps.onConfirmDelete).toHaveBeenCalledTimes(1);
    expect(baseProps.onDelete).not.toHaveBeenCalledWith(transactions[0]);

    await user.click(screen.getByRole('button', { name: 'No' }));
    expect(baseProps.onCancelDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps Delete buttons visible on non-confirming rows', () => {
    render(<TransactionList transactions={transactions} {...baseProps} confirmingId={1} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
  });
});
