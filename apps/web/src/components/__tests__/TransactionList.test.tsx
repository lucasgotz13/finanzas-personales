import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ApiTransaction } from '../../types';
import TransactionList from '../TransactionList';

const transactions: ApiTransaction[] = [
  { id: 1, direction: 'expense', amountMinor: 15000, currency: 'ARS', rate: 1, date: '2026-07-15', categoryId: 1, note: 'Lunch' },
  { id: 2, direction: 'income', amountMinor: 900000, currency: 'ARS', rate: 1, date: '2026-07-01', categoryId: 10, note: '' },
];

describe('TransactionList', () => {
  it('renders rows with category names and formatted amounts', () => {
    const names = new Map<number, string>([
      [1, 'Food'],
      [10, 'Salary'],
    ]);
    render(<TransactionList transactions={transactions} categoryNames={names} />);
    expect(screen.getByText('2026-07-15')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText(/ARS 150\.00/)).toBeInTheDocument();
    expect(screen.getByText(/ARS 9,000\.00/)).toBeInTheDocument();
  });

  it('renders an empty state when there are no transactions', () => {
    render(<TransactionList transactions={[]} categoryNames={new Map()} />);
    expect(screen.getByText(/No transactions yet/)).toBeInTheDocument();
  });

  it('falls back to the category id when the name is unknown', () => {
    render(<TransactionList transactions={[transactions[0]]} categoryNames={new Map()} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
  });
});
