import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgRoot, '../..');

// Step 1: Build core package
console.log('[build] Building core package...');
execSync('pnpm --filter @promptstash/core build', {
  cwd: repoRoot,
  stdio: 'inherit',
});

// Step 2: Bundle main process with esbuild
console.log('[build] Bundling main process...');
await esbuild.build({
  entryPoints: [path.join(pkgRoot, 'src/main/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(pkgRoot, 'dist/main/index.js'),
  external: ['electron', 'better-sqlite3'],
  sourcemap: true,
  minify: false,
  logLevel: 'info',
});

// Step 3: Build renderer with Vite
console.log('[build] Building renderer...');
execSync('npx vite build', {
  cwd: pkgRoot,
  stdio: 'inherit',
});

// Step 4: Rebuild better-sqlite3 for Electron's Node ABI
execSync('node scripts/native-rebuild.mjs electron', { cwd: pkgRoot, stdio: 'inherit' });

console.log('[build] Done!');
