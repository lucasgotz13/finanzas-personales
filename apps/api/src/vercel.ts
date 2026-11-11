/**
 * Vercel Function entry: the same Express app as src/index.ts, without
 * listen() and without migrations on boot (run `npm run migrate` against
 * Turso before deploying a new migration). Bundled by scripts/build-vercel.mjs.
 */
import { createClient } from '@libsql/client/web';
import { buildApp } from './http/app';
import { validateProductionConfig } from './http/auth';

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('TURSO_DATABASE_URL is required on Vercel (no local SQLite file there)');
validateProductionConfig(process.env.FINANZAS_AUTH_PASSPHRASE);

export default buildApp({
  db: createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN }),
  clock: { now: () => new Date() },
  authSecret: process.env.FINANZAS_AUTH_PASSPHRASE,
});
