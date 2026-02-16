/**
 * Rebuild better-sqlite3 native module for Electron or system Node.
 * Works with pnpm's virtual store by resolving the actual module path.
 * Skips rebuild if a marker file indicates the binary is already for the right target.
 *
 * Usage:
 *   node native-rebuild.mjs electron   # rebuild for Electron
 *   node native-rebuild.mjs node       # rebuild for system Node
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const require_ = createRequire(path.join(repoRoot, 'package.json'));

// Resolve better-sqlite3 directory in pnpm store
const bsq3Dir = path.dirname(require_.resolve('better-sqlite3/package.json'));
const markerFile = path.join(bsq3Dir, 'build', '.native-target');

const target = process.argv[2] || 'electron';

function currentMarker() {
  try { return readFileSync(markerFile, 'utf8').trim(); } catch { return ''; }
}

if (target === 'electron') {
  const electronPkgPath = require_.resolve('electron/package.json');
  const { version } = JSON.parse(readFileSync(electronPkgPath, 'utf8'));
  const expected = `electron-${version}-${process.arch}`;

  if (currentMarker() === expected) {
    console.log(`[native] better-sqlite3 already built for Electron ${version}, skipping.`);
    process.exit(0);
  }

  console.log(`[native] Rebuilding better-sqlite3 for Electron ${version} (${process.arch})...`);
  execSync(
    `npx --yes node-gyp rebuild --target=${version} --arch=${process.arch} --dist-url=https://electronjs.org/headers --build-from-source`,
    { cwd: bsq3Dir, stdio: 'inherit' }
  );
  writeFileSync(markerFile, expected);
} else {
  const expected = `node-${process.version}-${process.arch}`;

  if (currentMarker() === expected) {
    console.log(`[native] better-sqlite3 already built for Node ${process.version}, skipping.`);
    process.exit(0);
  }

  console.log(`[native] Rebuilding better-sqlite3 for system Node ${process.version}...`);
  execSync('npx --yes node-gyp rebuild', { cwd: bsq3Dir, stdio: 'inherit' });
  writeFileSync(markerFile, expected);
}

console.log('[native] Done.');
