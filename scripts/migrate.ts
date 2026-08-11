/**
 * SQLite/libSQL migration runner for the expense tracker.
 *
 * Reads db/migrations/*.sql in lexicographic order, applies each pending
 * migration atomically, and records it in schema_migrations.
 * Idempotent: running it twice applies nothing the second time.
 *
 * Works against a local file (default, or FINANZAS_DB) or a remote Turso
 * database (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN). Reused by apps/api tests
 * to build temp databases.
 */
import { createClient, type Client } from '@libsql/client';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DB_PATH = join(REPO_ROOT, 'finanzas.db');
export const MIGRATIONS_DIR = join(REPO_ROOT, 'db', 'migrations');

/**
 * Create a libSQL client. When TURSO_DATABASE_URL is set the client targets
 * the remote Turso database (using TURSO_AUTH_TOKEN for auth); otherwise it
 * targets the local file at `dbPath` (or FINANZAS_DB, or DEFAULT_DB_PATH).
 * Local connections get the runtime pragmas from the design (WAL + FK on).
 */
export async function createDbClient(dbPath?: string): Promise<Client> {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    return createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  const localPath = resolve(dbPath ?? process.env.FINANZAS_DB ?? DEFAULT_DB_PATH);
  const client = createClient({ url: `file:${localPath}`, timeout: 5000 });
  await client.execute('PRAGMA journal_mode = WAL;');
  await client.execute('PRAGMA foreign_keys = ON;');
  return client;
}

/** Apply pending migrations. Returns the list of versions applied in this run. */
export async function migrate(dbPath: string, migrationsDir: string): Promise<string[]> {
  const client = await createDbClient(dbPath);
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
  const appliedNow = await migrate(dbPath, MIGRATIONS_DIR);
  if (appliedNow.length > 0) {
    console.log(`Applied migrations: ${appliedNow.join(', ')}`);
  } else {
    console.log('No pending migrations. Database is up to date.');
  }
  console.log(`Database: ${process.env.TURSO_DATABASE_URL ?? dbPath}`);
}
