/**
 * SQLite/libSQL migration runner for the expense tracker.
 *
 * Reads db/migrations/*.sql in lexicographic order, applies each pending
 * migration atomically, and records it in schema_migrations.
 * Idempotent: running it twice applies nothing the second time.
 *
 * Works against a local file (explicit path, FINANZAS_DB, or default) or a
 * remote Turso database (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN) when no
 * explicit path is given. Tests build temp databases via createLocalClient
 * and migrate with an explicit path, which never consult the Turso variables.
 */
import { createClient, type Client } from '@libsql/client';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DB_PATH = join(REPO_ROOT, 'finanzas.db');
export const MIGRATIONS_DIR = join(REPO_ROOT, 'db', 'migrations');

/** Injectable `createClient` seam so tests can stub client construction. */
export type ClientFactory = typeof createClient;

/**
 * Create a libSQL client for an explicit local file. The path is used as-is
 * (resolved) and no environment variable is consulted, so callers that pass
 * an explicit path can never be redirected to a remote database. Local
 * connections get the runtime pragmas from the design (WAL + FK on).
 */
export async function createLocalClient(dbPath: string, factory: ClientFactory = createClient): Promise<Client> {
  const localPath = resolve(dbPath);
  const client = factory({ url: `file:${localPath}`, timeout: 5000 });
  await client.execute('PRAGMA journal_mode = WAL;');
  await client.execute('PRAGMA foreign_keys = ON;');
  return client;
}

/**
 * Create a libSQL client via production environment selection, unless an
 * explicit path is given. An explicit `dbPath` always delegates to
 * createLocalClient and never consults TURSO_DATABASE_URL. Without it, a set
 * TURSO_DATABASE_URL targets the remote Turso database (using
 * TURSO_AUTH_TOKEN for auth); otherwise the local file at FINANZAS_DB (or
 * DEFAULT_DB_PATH) is used.
 */
export async function createDbClient(dbPath?: string, factory: ClientFactory = createClient): Promise<Client> {
  if (dbPath !== undefined) {
    return createLocalClient(dbPath, factory);
  }
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    return factory({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return createLocalClient(process.env.FINANZAS_DB ?? DEFAULT_DB_PATH, factory);
}

/**
 * Apply pending migrations. Returns the list of versions applied in this run.
 * An explicit `dbPath` migrates that local file only; pass `undefined` for
 * production environment selection (remote when TURSO_DATABASE_URL is set).
 */
export async function migrate(
  dbPath: string | undefined,
  migrationsDir: string,
  factory: ClientFactory = createClient,
): Promise<string[]> {
  const client = await createDbClient(dbPath, factory);
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`);
    const appliedResult = await client.execute('SELECT version FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => String(row[0])));
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    const appliedNow: string[] = [];
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) continue;
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      const appliedAt = new Date().toISOString();
      await client.executeMultiple(
        `BEGIN;
${sql}
INSERT INTO schema_migrations (version, applied_at) VALUES ('${version.replace(/'/g, "''")}', '${appliedAt}');
COMMIT;`,
      );
      appliedNow.push(version);
    }
    return appliedNow;
  } finally {
    client.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

async function main(): Promise<void> {
  const dbPath = process.env.FINANZAS_DB ? resolve(process.env.FINANZAS_DB) : DEFAULT_DB_PATH;
  const appliedNow = await migrate(undefined, MIGRATIONS_DIR);
  if (appliedNow.length > 0) {
    console.log(`Applied migrations: ${appliedNow.join(', ')}`);
  } else {
    console.log('No pending migrations. Database is up to date.');
  }
  console.log(`Database: ${process.env.TURSO_DATABASE_URL ?? dbPath}`);
}
