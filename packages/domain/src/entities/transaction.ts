import { ValidationError } from '../errors';
import { Money, SUPPORTED_CURRENCIES, isSupportedCurrency } from '../vo/money';
import type { Currency } from '../vo/money';
import { DIRECTIONS, isDirection } from '../vo/direction';
import type { Direction } from '../vo/direction';
import { isArDateString } from '../vo/period-key';

export interface TransactionInput {
  id?: number;
  direction: Direction;
  amountMinor: number;
  currency: string;
  rate?: number;
  /** AR-calendar transaction date, YYYY-MM-DD (ET-3: attribution by tx date). */
  txDate: string;
  categoryId: number;
  note?: string;
}

/**
 * A single expense or income entry (ET-1..6, IT-1/2).
 * Validated on construction; immutable; rate normalized to 1 for ARS.
 */
export class Transaction {
  readonly id?: number;
  readonly direction: Direction;
  readonly amountMinor: number;
  readonly currency: string;
  readonly rate: number;
  readonly txDate: string;
  readonly categoryId: number;
  readonly note: string;

  constructor(input: TransactionInput) {
    const details: string[] = [];
    if (!isDirection(input.direction)) details.push('direction must be "expense" or "income"');
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      details.push('amountMinor must be a positive integer');
    }
    let currency: Currency = 'ARS';
    if (!isSupportedCurrency(input.currency)) {
      details.push(`currency must be one of ${SUPPORTED_CURRENCIES.join(', ')}`);
    } else {
      currency = input.currency;
    }
    if (!isArDateString(input.txDate)) {
      details.push('txDate must be a valid YYYY-MM-DD date');
    }
    if (!Number.isInteger(input.categoryId) || input.categoryId <= 0) {
      details.push('categoryId must be a positive integer');
    }
    if (input.note !== undefined && typeof input.note !== 'string') {
      details.push('note must be a string');
    }
    if (details.length > 0) {
      throw new ValidationError('Invalid transaction', details);
    }
    const money = new Money({ amountMinor: input.amountMinor, currency, rate: input.rate });
    this.id = input.id;
    this.direction = input.direction;
    this.amountMinor = money.amountMinor;
    this.currency = money.currency;
    this.rate = money.rate;
    this.txDate = input.txDate;
    this.categoryId = input.categoryId;
    this.note = input.note ?? '';
  }
}
