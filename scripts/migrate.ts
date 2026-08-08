/**
 * SQLite migration runner for the expense tracker.
 *
 * Reads db/migrations/*.sql in lexicographic order, applies each pending
 * migration inside a transaction, and records it in schema_migrations.
 * Idempotent: running it twice applies nothing the second time.
 *
 * Reused by apps/api tests to build temp databases.
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DB_PATH = join(REPO_ROOT, 'finanzas.db');
export const MIGRATIONS_DIR = join(REPO_ROOT, 'db', 'migrations');

/** Open a SQLite database with the runtime pragmas from the design (WAL + busy_timeout). */
export function openDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

/** Apply pending migrations. Returns the list of versions applied in this run. */
export function migrate(dbPath: string, migrationsDir: string): string[] {
  const db = openDb(dbPath);
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`);
    const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>;
    const applied = new Set(appliedRows.map((r) => r.version));
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    const appliedNow: string[] = [];
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) continue;
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      db.exec('BEGIN');
      try {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      appliedNow.push(version);
    }
    return appliedNow;
  } finally {
    db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dbPath = process.env.FINANZAS_DB ? resolve(process.env.FINANZAS_DB) : DEFAULT_DB_PATH;
  const appliedNow = migrate(dbPath, MIGRATIONS_DIR);
  if (appliedNow.length > 0) {
    console.log(`Applied migrations: ${appliedNow.join(', ')}`);
  } else {
    console.log('No pending migrations. Database is up to date.');
  }
  console.log(`Database: ${dbPath}`);
}
