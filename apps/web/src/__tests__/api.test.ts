import { describe, expect, it, vi } from 'vitest';
import { ApiError, api, translateApiError } from '../api';

describe('translateApiError (structured reason contract, issue #103)', () => {
  it('renders the trade timeline template from meta with exact es-AR parity (sell)', () => {
    const err = new ApiError(
      422,
      'VALIDATION_ERROR',
      'Invalid trade timeline',
      ['sell of 10 AAPL.BA on 2026-08-10 exceeds balance 5; fix that sell first'],
      'TRADE_EXCEEDS_BALANCE',
      { type: 'sell', ticker: 'AAPL.BA', quantity: 10, date: '2026-08-10', balance: 5 },
    );
    expect(translateApiError(err)).toBe('La venta de 10 AAPL.BA del 2026-08-10 supera el saldo de 5; corregí primero esa venta.');
  });

  it('renders the buy wording for a rejected buy', () => {
    const err = new ApiError(
      422,
      'VALIDATION_ERROR',
      'Invalid trade timeline',
      ['buy of 3 GGAL.BA on 2026-08-01 (id 7) exceeds balance 0; fix that buy first'],
      'TRADE_EXCEEDS_BALANCE',
      { type: 'buy', ticker: 'GGAL.BA', quantity: 3, date: '2026-08-01', balance: 0 },
    );
    expect(translateApiError(err)).toBe('La compra de 3 GGAL.BA del 2026-08-01 supera el saldo de 0; corregí primero esa compra.');
  });

  it('renders the lockout template with the remaining seconds', () => {
    const err = new ApiError(
      401,
      'UNAUTHORIZED',
      'Too many failed attempts',
      ['too many failed attempts; try again in 42s'],
      'AUTH_LOCKED',
      { seconds: 42 },
    );
    expect(translateApiError(err)).toBe('Demasiados intentos fallidos; espere 42 segundos.');
  });

  it('falls back to the exact-message table when the reason meta is missing', () => {
    const err = new ApiError(
      401,
      'UNAUTHORIZED',
      'Too many failed attempts',
      ['too many failed attempts; try again in 42s'],
      'AUTH_LOCKED',
    );
    expect(translateApiError(err)).toBe('Demasiados intentos fallidos; espere unos segundos.');
  });

  it('falls back to the exact-message table for static reasons', () => {
    const err = new ApiError(422, 'VALIDATION_ERROR', 'Invalid date', ['date must be YYYY-MM-DD'], 'INVALID_DATE');
    expect(translateApiError(err)).toBe('Fecha inválida.');
  });

  it('falls back to the raw message when there is no reason and no table entry', () => {
    const err = new ApiError(422, 'VALIDATION_ERROR', 'Something unexpected', ['boom']);
    expect(translateApiError(err)).toBe('Something unexpected');
  });

  it('parses reason and meta from the error envelope', async () => {
    const envelope = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid date',
        details: ['date must be YYYY-MM-DD'],
        reason: 'INVALID_DATE',
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => envelope }),
    );
    await expect(api.getSummary('month', '2026-02-31')).rejects.toMatchObject({ reason: 'INVALID_DATE' });
    vi.unstubAllGlobals();
  });
});
