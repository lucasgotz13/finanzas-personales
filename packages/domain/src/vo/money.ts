import { ValidationError } from '../errors';

/** Base currency: summaries and budgets are expressed in ARS. */
export const BASE_CURRENCY = 'ARS' as const;
export const SUPPORTED_CURRENCIES = ['ARS', 'USD'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export interface MoneyInput {
  amountMinor: number;
  currency: Currency;
  rate?: number;
}

/**
 * Money value object: integer minor units, currency, and the FX rate captured
 * at entry. ARS is the base currency and always carries rate 1; non-base
 * currencies require rate > 0 (ET-1/ET-2, IT-1/IT-2).
 */
export class Money {
  readonly amountMinor: number;
  readonly currency: Currency;
  readonly rate: number;

  constructor(input: MoneyInput) {
    const details: string[] = [];
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      details.push('amountMinor must be a positive integer');
    }
    if (!isSupportedCurrency(input.currency)) {
      details.push(`currency must be one of ${SUPPORTED_CURRENCIES.join(', ')}`);
    }
    const rate = input.currency === BASE_CURRENCY ? 1 : input.rate;
    if (input.currency !== BASE_CURRENCY && (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)) {
      details.push('rate is required and must be > 0 for non-ARS currencies');
    }
    if (details.length > 0) {
      throw new ValidationError('Invalid money value', details);
    }
    this.amountMinor = input.amountMinor;
    this.currency = input.currency;
    this.rate = rate as number;
  }

  /** Convert to ARS minor units using the entry rate; rounds once (BM-1). */
  toArsMinor(): number {
    return Math.round(this.amountMinor * this.rate);
  }
}
