import { ValidationError } from '../errors';

export const DIRECTIONS = ['expense', 'income'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && (DIRECTIONS as readonly string[]).includes(value);
}

/** Parse a raw direction value; throws a ValidationError otherwise (ET-1, IT-1). */
export function parseDirection(value: unknown): Direction {
  if (isDirection(value)) return value;
  throw new ValidationError('Invalid direction', ['direction must be "expense" or "income"']);
}
