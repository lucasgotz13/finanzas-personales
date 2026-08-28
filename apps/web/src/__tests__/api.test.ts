import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(translateApiError(err)).toBe('La venta de 10 AAPL.BA del 2026-08-10 supera el saldo de 5; corrija primero esa venta.');
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
    expect(translateApiError(err)).toBe('La compra de 3 GGAL.BA del 2026-08-01 supera el saldo de 0; corrija primero esa compra.');
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

describe('GET dedup and short cache (optimize batch)', () => {
  // The cache/dedup maps live at module level, so every test gets a fresh
  // module instance (vi.resetModules) and a fresh fetch stub.
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  const treeBody = [
    { id: 1, name: 'Food', parentId: null, children: [] },
  ];

  function stubFetch(body: unknown, ok = true): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 422,
      json: async () => body,
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('deduplicates concurrent identical GETs into a single fetch', async () => {
    const { api: freshApi } = await import('../api');
    const fetchMock = stubFetch(treeBody);

    const [a, b] = await Promise.all([freshApi.getCategoryTree(), freshApi.getCategoryTree()]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves a completed GET from the cache within the TTL without a second fetch', async () => {
    const { api: freshApi } = await import('../api');
    const fetchMock = stubFetch(treeBody);

    await freshApi.getCategoryTree();
    await freshApi.getCategoryTree();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the completed cache on any mutation so the next read re-fetches', async () => {
    const { api: freshApi } = await import('../api');
    const fetchMock = stubFetch(treeBody);

    await freshApi.getCategoryTree();
    await freshApi.createCategory({ name: 'New' });
    await freshApi.getCategoryTree();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not cache the result of a GET that was in flight during a mutation', async () => {
    const { api: freshApi } = await import('../api');
    const getResponses: Array<() => void> = [];
    let autoResolveGets = false;
    const fetchMock = vi.fn((_url: string, options?: RequestInit) => {
      if (options?.method !== undefined && options.method !== 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response);
      }
      if (autoResolveGets) {
        return Promise.resolve({ ok: true, status: 200, json: async () => treeBody } as unknown as Response);
      }
      return new Promise<Response>((res) => {
        getResponses.push(() => res({ ok: true, status: 200, json: async () => treeBody } as unknown as Response));
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    // Two shared in-flight GETs, then a mutation while they are pending.
    const first = freshApi.getCategoryTree();
    const second = freshApi.getCategoryTree();
    await freshApi.createCategory({ name: 'New' });
    expect(getResponses).toHaveLength(1); // concurrent identical GETs deduped
    getResponses[0]();
    await Promise.all([first, second]);

    // The stale result must not be cached: the next read fetches again.
    autoResolveGets = true;
    await freshApi.getCategoryTree();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never caches /transactions reads (mutation-prone)', async () => {
    const { api: freshApi } = await import('../api');
    const fetchMock = stubFetch([]);

    await freshApi.listTransactions({ month: '2026-08' });
    await freshApi.listTransactions({ month: '2026-08' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never caches /budgets/status (volatile)', async () => {
    const { api: freshApi } = await import('../api');
    const fetchMock = stubFetch({ month: '2026-08', categories: [], global: { cap: 0, consumed: 0, overBudget: false } });

    await freshApi.getBudgetStatus('2026-08');
    await freshApi.getBudgetStatus('2026-08');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
