import { ValidationError } from '../errors';

export interface CategoryInput {
  id?: number;
  name: string;
  parentId: number | null;
  /** ISO timestamp of the soft-delete, or null while active (CM-4). */
  deletedAt: string | null;
}

/**
 * Category node in the hierarchy (CM-1..5). IDs are stable: transactions
 * reference categoryId, never the name (CM-3).
 */
export class Category {
  readonly id?: number;
  readonly name: string;
  readonly parentId: number | null;
  readonly deletedAt: string | null;

  constructor(input: CategoryInput) {
    const details: string[] = [];
    if (typeof input.name !== 'string' || input.name.trim() === '') {
      details.push('name must be a non-empty string');
    }
    if (input.parentId !== null && (!Number.isInteger(input.parentId) || input.parentId <= 0)) {
      details.push('parentId must be a positive integer or null');
    }
    if (input.id !== undefined && input.parentId === input.id) {
      details.push('a category cannot be its own parent');
    }
    if (input.deletedAt !== null && typeof input.deletedAt !== 'string') {
      details.push('deletedAt must be an ISO timestamp or null');
    }
    if (details.length > 0) {
      throw new ValidationError('Invalid category', details);
    }
    this.id = input.id;
    this.name = input.name.trim();
    this.parentId = input.parentId;
    this.deletedAt = input.deletedAt;
  }
}
