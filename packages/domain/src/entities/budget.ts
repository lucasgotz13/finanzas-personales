import { ValidationError } from '../errors';

export interface BudgetInput {
  categoryId: number;
  /** Monthly cap in ARS minor units; must be > 0 (BM-1). */
  capMinor: number;
}

/** Per-category monthly cap in base currency (ARS). */
export class Budget {
  readonly categoryId: number;
  readonly capMinor: number;

  constructor(input: BudgetInput) {
    const details: string[] = [];
    if (!Number.isInteger(input.categoryId) || input.categoryId <= 0) {
      details.push('categoryId must be a positive integer');
    }
    if (!Number.isInteger(input.capMinor) || input.capMinor <= 0) {
      details.push('capMinor must be a positive integer');
    }
    if (details.length > 0) {
      throw new ValidationError('Invalid budget', details);
    }
    this.categoryId = input.categoryId;
    this.capMinor = input.capMinor;
  }
}
