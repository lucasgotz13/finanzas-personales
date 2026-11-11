// Builds the API as a Vercel Build Output API v3 function: one self-contained
// bundle (the domain package ships raw TS, so Vercel cannot run it unbundled)
// and a catch-all route so Express sees every /api/v1 path.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(apiDir, '.vercel/output');
const funcDir = join(outDir, 'functions/index.func');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(funcDir, { recursive: true });

await build({
  entryPoints: [join(apiDir, 'src/vercel.ts')],
  outfile: join(funcDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Express is CommonJS and require()s Node builtins; ESM bundles need a real require.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

const json = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
json(join(funcDir, '.vc-config.json'), {
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  // Plain Node req/res: Vercel's helpers would pre-parse the body before express.json().
  shouldAddHelpers: false,
});
json(join(outDir, 'config.json'), {
  version: 3,
  routes: [{ src: '/(.*)', dest: '/index' }],
});

console.log(`Vercel output written to ${outDir}`);
