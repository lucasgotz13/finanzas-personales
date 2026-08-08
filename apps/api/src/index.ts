import { resolve } from 'node:path';
import type { Clock } from '@finanzas/domain';
import { DEFAULT_DB_PATH, MIGRATIONS_DIR, migrate, openDb } from '../../../scripts/migrate';
import { buildApp } from './http/app';

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

const dbPath = process.env.FINANZAS_DB ? resolve(process.env.FINANZAS_DB) : DEFAULT_DB_PATH;
migrate(dbPath, MIGRATIONS_DIR);
const db = openDb(dbPath);
const app = buildApp({ db, clock: new SystemClock() });

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Finanzas API listening on http://localhost:${port} (db: ${dbPath})`);
});
