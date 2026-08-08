import { describe, expect, it } from 'vitest';
import { Category } from '../../src/entities/category';
import { ValidationError } from '../../src/errors';

describe('Category entity', () => {
  it('creates a root category with trimmed name', () => {
    const cat = new Category({ name: '  Food  ', parentId: null, deletedAt: null });
    expect(cat.name).toBe('Food');
    expect(cat.parentId).toBeNull();
    expect(cat.deletedAt).toBeNull();
  });

  it('creates a nested category under a parent (CM-1)', () => {
    const cat = new Category({ name: 'Rent', parentId: 3, deletedAt: null });
    expect(cat.parentId).toBe(3);
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(() => new Category({ name: '', parentId: null, deletedAt: null })).toThrow(ValidationError);
    expect(() => new Category({ name: '   ', parentId: null, deletedAt: null })).toThrow(ValidationError);
  });

  it('rejects a category that is its own parent (CM-1)', () => {
    expect(() => new Category({ id: 5, name: 'Food', parentId: 5, deletedAt: null })).toThrow(ValidationError);
  });

  it('rejects a non-integer parentId', () => {
    expect(() => new Category({ name: 'X', parentId: 1.5, deletedAt: null })).toThrow(ValidationError);
  });
});
