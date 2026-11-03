import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Clock } from '@finanzas/domain';
import { DEFAULT_DB_PATH, MIGRATIONS_DIR, createDbClient, migrate } from '../../../scripts/migrate';
import { validateProductionConfig } from './http/auth';
import { buildApp } from './http/app';

// Local dev convenience: load the repo-root .env when present. Host-provided
// environment variables win (process.loadEnvFile never overrides them), and a
// production host without a .env file simply keeps its own environment.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  process.loadEnvFile(resolve(REPO_ROOT, '.env'));
} catch {
  // No .env file: rely on the host environment.
}

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

const dbPath = process.env.FINANZAS_DB ? resolve(process.env.FINANZAS_DB) : DEFAULT_DB_PATH;
validateProductionConfig(process.env.FINANZAS_AUTH_PASSPHRASE);
await migrate(undefined, MIGRATIONS_DIR);
const db = await createDbClient();
const app = buildApp({ db, clock: new SystemClock(), authSecret: process.env.FINANZAS_AUTH_PASSPHRASE });

const port = Number(process.env.PORT ?? 3000);
const dbTarget = process.env.TURSO_DATABASE_URL ?? dbPath;
app.listen(port, () => {
  console.log(`Finanzas API listening on http://localhost:${port} (db: ${dbTarget})`);
});
