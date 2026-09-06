import { ValidationError } from '../errors';
import { SUPPORTED_CURRENCIES, isSupportedCurrency } from '../vo/money';
import { isArDateString } from '../vo/period-key';

export interface GoalInput {
  id?: number;
  /** User-visible name; stored trimmed. */
  name: string;
  /** Target in minor units; must be > 0. */
  targetMinor: number;
  /** Goal currency (ARS/USD); no conversion is ever applied. */
  currency: string;
  /** Optional deadline as an AR-calendar date (YYYY-MM-DD) or null. */
  deadline: string | null;
  /** ISO instant of creation; set automatically, never user-provided. */
  createdAt: string;
  /** Zero-based rank: lower fills first (ties broken by creation order). */
  priority: number;
}

/** A savings goal: name + target + currency + optional deadline. */
export class Goal {
  readonly id?: number;
  readonly name: string;
  readonly targetMinor: number;
  readonly currency: string;
  readonly deadline: string | null;
  readonly createdAt: string;
  readonly priority: number;

  constructor(input: GoalInput) {
    const details: string[] = [];
    if (typeof input.name !== 'string' || input.name.trim() === '') {
      details.push('name must be a non-empty string');
    }
    if (!Number.isInteger(input.targetMinor) || input.targetMinor <= 0) {
      details.push('targetMinor must be a positive integer');
    }
    if (!isSupportedCurrency(input.currency)) {
      details.push(`currency must be one of ${SUPPORTED_CURRENCIES.join(', ')}`);
    }
    if (input.deadline !== null && !isArDateString(input.deadline)) {
      details.push('deadline must be a valid YYYY-MM-DD date or null');
    }
    if (typeof input.createdAt !== 'string' || Number.isNaN(Date.parse(input.createdAt))) {
      details.push('createdAt must be an ISO timestamp');
    }
    if (!Number.isInteger(input.priority) || input.priority < 0) {
      details.push('priority must be a non-negative integer');
    }
    if (details.length > 0) {
      throw new ValidationError('Invalid goal', details);
    }
    this.id = input.id;
    this.name = (input.name as string).trim();
    this.targetMinor = input.targetMinor;
    this.currency = input.currency;
    this.deadline = input.deadline;
    this.createdAt = input.createdAt;
    this.priority = input.priority;
  }
}

export interface GoalAdjustmentInput {
  id?: number;
  goalId: number;
  /** Signed minor units: positive for aportes, negative for retiros. */
  amountMinor: number;
  /** ISO instant of creation; set automatically, never user-provided. */
  createdAt: string;
}

/**
 * A manual movement on a goal (aporte/retiro). The running total is never
 * stored: progress is always derived from these rows plus the automatic
 * surplus, so the number can never be overwritten by hand.
 */
export class GoalAdjustment {
  readonly id?: number;
  readonly goalId: number;
  readonly amountMinor: number;
  readonly createdAt: string;

  constructor(input: GoalAdjustmentInput) {
    const details: string[] = [];
    if (!Number.isInteger(input.goalId) || input.goalId <= 0) {
      details.push('goalId must be a positive integer');
    }
    if (!Number.isInteger(input.amountMinor) || input.amountMinor === 0) {
      details.push('amountMinor must be a non-zero integer');
    }
    if (typeof input.createdAt !== 'string' || Number.isNaN(Date.parse(input.createdAt))) {
      details.push('createdAt must be an ISO timestamp');
    }
    if (details.length > 0) {
      throw new ValidationError('Invalid adjustment', details);
    }
    this.id = input.id;
    this.goalId = input.goalId;
    this.amountMinor = input.amountMinor;
    this.createdAt = input.createdAt;
  }
}
