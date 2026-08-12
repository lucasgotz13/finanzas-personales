import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors';
import { normalizeTicker, PRICE_TTL_MS } from '../../src/investments/catalog';

describe('normalizeTicker (PI-1)', () => {
  it('uppercases and auto-appends .BA when the ticker has no suffix', () => {
    expect(normalizeTicker('aapl')).toBe('AAPL.BA');
    expect(normalizeTicker('ggal')).toBe('GGAL.BA');
    expect(normalizeTicker(' meli ')).toBe('MELI.BA');
  });

  it('keeps an already-suffixed ticker, uppercased', () => {
    expect(normalizeTicker('aapl.ba')).toBe('AAPL.BA');
    expect(normalizeTicker('YPFD.BA')).toBe('YPFD.BA');
  });

  it('rejects empty and malformed tickers', () => {
    expect(() => normalizeTicker('')).toThrow(ValidationError);
    expect(() => normalizeTicker('   ')).toThrow(ValidationError);
    expect(() => normalizeTicker('aa pl')).toThrow(ValidationError);
    expect(() => normalizeTicker('aa@pl')).toThrow(ValidationError);
    expect(() => normalizeTicker('aapl..ba')).toThrow(ValidationError);
  });
});

describe('equity price TTL catalog (PI-3)', () => {
  it('exposes an ≈5 min TTL for equity snapshots', () => {
    expect(PRICE_TTL_MS).toBe(5 * 60_000);
  });
});
