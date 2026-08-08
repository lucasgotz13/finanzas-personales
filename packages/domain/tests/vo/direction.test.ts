import { describe, expect, it } from 'vitest';
import { parseDirection } from '../../src/vo/direction';
import { ValidationError } from '../../src/errors';

describe('Direction', () => {
  it('parses expense and income', () => {
    expect(parseDirection('expense')).toBe('expense');
    expect(parseDirection('income')).toBe('income');
  });

  it('rejects unknown directions (ET-1, IT-1)', () => {
    expect(() => parseDirection('transfer')).toThrow(ValidationError);
    expect(() => parseDirection(undefined)).toThrow(ValidationError);
    expect(() => parseDirection('')).toThrow(ValidationError);
  });
});
