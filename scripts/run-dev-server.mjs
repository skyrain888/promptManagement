import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outfile = path.join(repoRoot, 'dist/dev-server.cjs');

// Bundle dev-server.ts with esbuild (resolves ESM/CJS issues)
await esbuild.build({
  entryPoints: [path.join(__dirname, 'dev-server.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  sourcemap: true,
  logLevel: 'info',
  alias: {
    '@promptstash/core': path.join(repoRoot, 'packages/core/src/index.ts'),
  },
  external: ['better-sqlite3'],
});

// Run the bundled server
execSync(`node ${outfile}`, { stdio: 'inherit', cwd: repoRoot });
