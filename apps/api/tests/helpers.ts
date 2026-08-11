import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from '@libsql/client';
import type { Express } from 'express';
import type { Clock, IndicatorSource } from '@finanzas/domain';
import { createDbClient, MIGRATIONS_DIR, migrate } from '../../../scripts/migrate';
import { buildApp } from '../src/http/app';

export class FakeClock implements Clock {
  constructor(private date: Date) {}
  now(): Date {
    return this.date;
  }
}

export interface TestEnv {
  app: Express;
  db: Client;
  cleanup: () => void;
}

/** Builds the app against a fresh temp SQLite database (migrated + seeded). */
export async function createTestApp(
  now = new Date('2026-08-08T12:00:00.000Z'),
  deps: { indicatorSources?: IndicatorSource[] } = {},
): Promise<TestEnv> {
  const dir = mkdtempSync(join(tmpdir(), 'finanzas-test-'));
  const dbPath = join(dir, 'test.db');
  await migrate(dbPath, MIGRATIONS_DIR);
  const db = await createDbClient(dbPath);
  const app = buildApp({ db, clock: new FakeClock(now), indicatorSources: deps.indicatorSources });
  return {
    app,
    db,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
