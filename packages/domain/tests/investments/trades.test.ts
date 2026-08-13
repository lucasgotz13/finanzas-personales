import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/errors';
import { DerivedPositionRepository } from '../../src/investments/derived-repo';
import { TradeService } from '../../src/investments/trades';
import type { LegacyPositionPort, TradeRepository } from '../../src/investments/ports';
import type { Position, Trade, TradeInput } from '../../src/investments/types';

class InMemoryTradeRepository implements TradeRepository {
  private rows = new Map<number, Trade>();
  private nextId = 1;
  async list(): Promise<Trade[]> {
    return [...this.rows.values()];
  }
  async create(input: TradeInput): Promise<Trade> {
    const stored: Trade = { ...input, id: this.nextId++ };
    this.rows.set(stored.id, stored);
    return stored;
  }
  async update(id: number, input: TradeInput): Promise<Trade | null> {
    if (!this.rows.has(id)) return null;
    const stored: Trade = { ...input, id };
    this.rows.set(id, stored);
    return stored;
  }
  async delete(id: number): Promise<boolean> {
    return this.rows.delete(id);
  }
}

class StubLegacyPositions implements LegacyPositionPort {
  constructor(private rows: Position[] = []) {}
  async list(): Promise<Position[]> {
    return this.rows;
  }
}

function buy(ticker: string, date: string, quantity: number, priceMinor: number): TradeInput {
  return { ticker, type: 'buy', date, quantity, priceMinor, currency: 'USD' };
}

function sell(ticker: string, date: string, quantity: number, priceMinor: number): TradeInput {
  return { ticker, type: 'sell', date, quantity, priceMinor, currency: 'USD' };
}

function makeService(): { service: TradeService; repo: InMemoryTradeRepository } {
  const repo = new InMemoryTradeRepository();
  return { service: new TradeService({ trades: repo }), repo };
}

describe('TradeService.create (TH-1)', () => {
  it('normalizes the ticker to uppercase with .BA and persists the trade', async () => {
    const { service } = makeService();
    const created = await service.create(buy('aapl', '2026-08-01', 10, 18000));
    expect(created).toMatchObject({ ticker: 'AAPL.BA', type: 'buy', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' });
    expect(created.id).toBeGreaterThan(0);
    expect(await service.list()).toHaveLength(1);
  });

  it('rejects invalid input with 422 and persists nothing', async () => {
    const { service } = makeService();
    const cases: Array<Partial<TradeInput>> = [
      { ...buy('aapl', '2026-08-01', 10, 18000), type: 'hold' as 'buy' },
      { ...buy('', '2026-08-01', 10, 18000) },
      { ...buy('aapl', '2026-08-01', 0, 18000) },
      { ...buy('aapl', '2026-08-01', -1, 18000) },
      { ...buy('aapl', '2026-08-01', 10, 0) },
      { ...buy('aapl', '2026-08-01', 10, -18000) },
      { ...buy('aapl', '2026-08-01', 10, 18000), currency: 'ARS' as 'USD' },
      { ...buy('aapl', 'not-a-date', 10, 18000) },
      { ...buy('aapl', '2026-13-01', 10, 18000) },
      { ...buy('aapl', '2026-02-30', 10, 18000) },
    ];
    for (const input of cases) {
      await expect(service.create(input as TradeInput)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await service.list()).toHaveLength(0);
  });
});

describe('TradeService.update/delete (TH-1)', () => {
  it('returns a not-found error for an unknown id', async () => {
    const { service } = makeService();
    await expect(service.update(999, buy('aapl', '2026-08-01', 1, 100))).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete(999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('replaces the trade fully on update', async () => {
    const { service } = makeService();
    await service.create(buy('aapl', '2026-08-01', 10, 18000));
    const created = await service.create(sell('aapl', '2026-08-02', 2, 20000));
    const updated = await service.update(created.id, sell('aapl', '2026-08-03', 3, 21000));
    expect(updated).toMatchObject({ id: created.id, type: 'sell', date: '2026-08-03', quantity: 3, priceMinor: 21000 });
    expect(await service.list()).toHaveLength(2);
  });

  it('deletes the trade', async () => {
    const { service } = makeService();
    const created = await service.create(buy('aapl', '2026-08-01', 10, 18000));
    await service.delete(created.id);
    expect(await service.list()).toHaveLength(0);
  });
});

describe('TradeService timeline integrity (TH-2)', () => {
  it('rejects a sell that exceeds the running balance, naming the trade', async () => {
    const { service, repo } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 5, 18000));

    await expect(service.create(sell('AAPL.BA', '2026-08-10', 10, 25000))).rejects.toMatchObject({
      details: ['sell of 10 AAPL.BA on 2026-08-10 exceeds balance 5; fix that sell first'],
    });
    expect((await repo.list()).map((t) => t.id)).toEqual([1]);
  });

  it('rejects an edit that would make a later sell exceed the balance, naming the dependent sell', async () => {
    const { service, repo } = makeService();
    const initial = await service.create(buy('AAPL.BA', '2026-08-01', 10, 18000));
    const later = await service.create(sell('AAPL.BA', '2026-08-05', 8, 25000));

    await expect(service.update(initial.id, buy('AAPL.BA', '2026-08-01', 5, 18000))).rejects.toMatchObject({
      details: [`sell of 8 AAPL.BA on 2026-08-05 (id ${later.id}) exceeds balance 5; fix that sell first`],
    });
    const stored = (await repo.list()).find((t) => t.id === initial.id);
    expect(stored?.quantity).toBe(10); // nothing persisted
  });

  it('rejects a delete that would make a later sell exceed the balance, naming the dependent sell', async () => {
    const { service, repo } = makeService();
    const initial = await service.create(buy('AAPL.BA', '2026-08-01', 10, 18000));
    const later = await service.create(sell('AAPL.BA', '2026-08-05', 8, 25000));

    await expect(service.delete(initial.id)).rejects.toMatchObject({
      details: [`sell of 8 AAPL.BA on 2026-08-05 (id ${later.id}) exceeds balance 0; fix that sell first`],
    });
    expect((await repo.list()).map((t) => t.id).sort()).toEqual([initial.id, later.id]);
  });

  it('computes same-day balances in insertion order (id)', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-03', 10, 18000));
    await service.create(sell('AAPL.BA', '2026-08-03', 3, 20000));
    await service.create(buy('AAPL.BA', '2026-08-03', 2, 21000));

    // Balance after the three same-day trades is 9 in insertion order; a sell
    // of 10 must be rejected against that balance (TH-2).
    await expect(service.create(sell('AAPL.BA', '2026-08-03', 10, 20000))).rejects.toMatchObject({
      details: ['sell of 10 AAPL.BA on 2026-08-03 exceeds balance 9; fix that sell first'],
    });
    // A valid same-day sell of 9 is accepted — buys are always allowed too.
    const ok = await service.create(sell('AAPL.BA', '2026-08-03', 9, 20000));
    expect(ok.quantity).toBe(9);
  });
});

describe('TradeService derived positions (TH-3)', () => {
  it('averages buys into one moving-average cost', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 10, 18000));
    await service.create(buy('AAPL.BA', '2026-08-02', 10, 22000));

    const positions = await service.derivedPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ ticker: 'AAPL.BA', quantity: 20, avgCostMinor: 20000 });
  });

  it('keeps the moving average unchanged on a sell', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 10, 18000));
    await service.create(buy('AAPL.BA', '2026-08-02', 10, 22000));
    await service.create(sell('AAPL.BA', '2026-08-03', 5, 25000));

    const positions = await service.derivedPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ ticker: 'AAPL.BA', quantity: 15, avgCostMinor: 20000 });
  });

  it('drops a fully sold ticker and restarts the average on the next buy', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 20, 20000));
    await service.create(sell('AAPL.BA', '2026-08-02', 20, 25000));

    expect(await service.derivedPositions()).toEqual([]);

    await service.create(buy('AAPL.BA', '2026-08-03', 5, 30000));
    const positions = await service.derivedPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ quantity: 5, avgCostMinor: 30000 });
  });

  it('assigns a stable negative derived id and the ticker as name without a legacy record', async () => {
    const { service } = makeService();
    await service.create(buy('MELI.BA', '2026-08-01', 2, 50000));

    const first = await service.derivedPositions();
    const second = await service.derivedPositions();
    expect(first[0].id).toBeLessThan(0);
    expect(first[0].id).toBe(second[0].id);
    expect(first[0].name).toBe('MELI.BA');
  });
});

describe('TradeService realized totals (TH-4)', () => {
  it('credits a gain per asset and portfolio', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 10, 20000));
    await service.create(sell('AAPL.BA', '2026-08-02', 5, 25000));

    const totals = await service.realizedTotals();
    expect(totals.perTicker['AAPL.BA']).toBe(25000);
    expect(totals.total).toBe(25000);
  });

  it('records losses negative', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 10, 20000));
    await service.create(sell('AAPL.BA', '2026-08-02', 5, 15000));

    const totals = await service.realizedTotals();
    expect(totals.perTicker['AAPL.BA']).toBe(-25000);
    expect(totals.total).toBe(-25000);
  });

  it('accumulates realized P&L across sells per asset and portfolio', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 10, 18000));
    await service.create(sell('AAPL.BA', '2026-08-02', 5, 25000));
    await service.create(sell('AAPL.BA', '2026-08-03', 2, 24000));
    await service.create(buy('GGAL.BA', '2026-08-01', 10, 6000));
    await service.create(sell('GGAL.BA', '2026-08-02', 4, 7000));

    const totals = await service.realizedTotals();
    expect(totals.perTicker['AAPL.BA']).toBe((25000 - 18000) * 5 + (24000 - 18000) * 2);
    expect(totals.perTicker['GGAL.BA']).toBe((7000 - 6000) * 4);
    expect(totals.total).toBe(47000 + 4000);
  });

  it('uses the moving average in force at sell time', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 10, 18000));
    await service.create(buy('AAPL.BA', '2026-08-02', 10, 22000)); // avg 20000
    await service.create(sell('AAPL.BA', '2026-08-03', 5, 21000));

    const totals = await service.realizedTotals();
    expect(totals.perTicker['AAPL.BA']).toBe((21000 - 20000) * 5);
  });
});

describe('DerivedPositionRepository (PI-1, D2, D3)', () => {
  function legacyPosition(id: number, ticker: string, name: string): Position {
    return { id, ticker, name, quantity: 0, avgCostMinor: 0, currency: 'USD', createdAt: '2026-08-01T00:00:00.000Z' };
  }

  it('preserves the legacy id and name, merging only those fields', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 10, 18000));
    const repo = new DerivedPositionRepository(service, new StubLegacyPositions([legacyPosition(5, 'AAPL.BA', 'Apple')]));

    const positions = await repo.list();
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ id: 5, name: 'Apple', quantity: 10, avgCostMinor: 18000, currency: 'USD' });
  });

  it('derives a negative-hash id and ticker name without a legacy record', async () => {
    const { service } = makeService();
    await service.create(buy('MELI.BA', '2026-08-01', 2, 50000));
    const repo = new DerivedPositionRepository(service, new StubLegacyPositions());

    const positions = await repo.list();
    expect(positions[0].id).toBeLessThan(0);
    expect(positions[0].name).toBe('MELI.BA');
  });

  it('exposes no position for tickers without trades, even with a legacy record', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 10, 18000));
    const repo = new DerivedPositionRepository(service, new StubLegacyPositions([legacyPosition(9, 'GGAL.BA', 'Galicia')]));

    const positions = await repo.list();
    expect(positions.map((p) => p.ticker)).toEqual(['AAPL.BA']);
  });

  it('finds a merged position by ticker', async () => {
    const { service } = makeService();
    await service.create(buy('AAPL.BA', '2026-08-01', 10, 18000));
    const repo = new DerivedPositionRepository(service, new StubLegacyPositions([legacyPosition(5, 'AAPL.BA', 'Apple')]));

    const found = await repo.findByTicker('AAPL.BA');
    expect(found).toMatchObject({ id: 5, name: 'Apple' });
    expect(await repo.findByTicker('MELI.BA')).toBeNull();
  });
});
