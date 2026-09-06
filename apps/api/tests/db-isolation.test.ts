import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Client } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DB_PATH,
  createDbClient,
  createLocalClient,
  migrate,
} from '../../../scripts/migrate';
import type { ClientFactory } from '../../../scripts/migrate';

const FAKE_REMOTE_URL = 'libsql://fake-remote.turso.io';
const FAKE_AUTH_TOKEN = 'fake-token-for-isolation-test';

const ENV_KEYS = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'FINANZAS_DB'] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

/** Records every client configuration without opening any connection. */
function stubFactory() {
  const seen: unknown[] = [];
  const execute = vi.fn(async () => ({ rows: [] }));
  const executeMultiple = vi.fn(async () => undefined);
  const close = vi.fn(() => undefined);
  const fake = { execute, executeMultiple, close } as unknown as Client;
  const factory = vi.fn(((config: unknown) => {
    seen.push(config);
    return fake;
  }) as unknown as ClientFactory);
  return { factory, seen, execute, executeMultiple, close };
}

function useFakeRemote(): void {
  process.env.TURSO_DATABASE_URL = FAKE_REMOTE_URL;
  process.env.TURSO_AUTH_TOKEN = FAKE_AUTH_TOKEN;
  process.env.FINANZAS_DB = join(tmpdir(), 'should-be-ignored.db');
}

describe('local test database isolation (item 1)', () => {
  it('createDbClient with an explicit path never selects the remote', async () => {
    useFakeRemote();
    const dir = mkdtempSync(join(tmpdir(), 'finanzas-isolation-'));
    try {
      const dbPath = join(dir, 'test.db');
      const { factory, seen } = stubFactory();

      const db = await createDbClient(dbPath, factory);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(seen[0]).toMatchObject({ url: `file:${resolve(dbPath)}` });
      expect(JSON.stringify(seen)).not.toContain(FAKE_REMOTE_URL);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('createLocalClient ignores TURSO_DATABASE_URL, TURSO_AUTH_TOKEN and FINANZAS_DB', async () => {
    useFakeRemote();
    const dir = mkdtempSync(join(tmpdir(), 'finanzas-isolation-'));
    try {
      const dbPath = join(dir, 'test.db');
      const { factory, seen, execute } = stubFactory();

      const db = await createLocalClient(dbPath, factory);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(seen[0]).toMatchObject({ url: `file:${resolve(dbPath)}` });
      expect(JSON.stringify(seen)).not.toContain(FAKE_REMOTE_URL);
      // Local clients still apply the runtime pragmas.
      expect(execute).toHaveBeenCalledTimes(2);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('migrate with an explicit path never touches the remote', async () => {
    useFakeRemote();
    const dir = mkdtempSync(join(tmpdir(), 'finanzas-isolation-'));
    const emptyMigrationsDir = mkdtempSync(join(tmpdir(), 'finanzas-empty-migrations-'));
    try {
      const dbPath = join(dir, 'test.db');
      const { factory, seen } = stubFactory();

      const applied = await migrate(dbPath, emptyMigrationsDir, factory);

      expect(applied).toEqual([]);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(seen[0]).toMatchObject({ url: `file:${resolve(dbPath)}` });
      expect(JSON.stringify(seen)).not.toContain(FAKE_REMOTE_URL);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(emptyMigrationsDir, { recursive: true, force: true });
    }
  });

  it('production selection without an explicit path still honors TURSO_DATABASE_URL', async () => {
    useFakeRemote();
    const { factory, seen, execute } = stubFactory();

    const db = await createDbClient(undefined, factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(seen[0]).toMatchObject({ url: FAKE_REMOTE_URL, authToken: FAKE_AUTH_TOKEN });
    // Remote clients do not run local file pragmas.
    expect(execute).not.toHaveBeenCalled();
    db.close();
  });

  it('migrate without an explicit path still migrates the remote when TURSO_DATABASE_URL is set', async () => {
    useFakeRemote();
    const emptyMigrationsDir = mkdtempSync(join(tmpdir(), 'finanzas-empty-migrations-'));
    try {
      const { factory, seen } = stubFactory();

      await migrate(undefined, emptyMigrationsDir, factory);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(seen[0]).toMatchObject({ url: FAKE_REMOTE_URL, authToken: FAKE_AUTH_TOKEN });
    } finally {
      rmSync(emptyMigrationsDir, { recursive: true, force: true });
    }
  });

  it('production selection without TURSO_DATABASE_URL falls back to FINANZAS_DB then DEFAULT_DB_PATH', async () => {
    const customPath = join(tmpdir(), 'finanzas-custom.db');
    process.env.FINANZAS_DB = customPath;
    const { factory: factoryA, seen: seenA } = stubFactory();
    (await createDbClient(undefined, factoryA)).close();
    expect(seenA[0]).toMatchObject({ url: `file:${resolve(customPath)}` });

    delete process.env.FINANZAS_DB;
    const { factory: factoryB, seen: seenB } = stubFactory();
    (await createDbClient(undefined, factoryB)).close();
    expect(seenB[0]).toMatchObject({ url: `file:${resolve(DEFAULT_DB_PATH)}` });
  });
});
