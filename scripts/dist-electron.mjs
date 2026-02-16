#!/usr/bin/env node

/**
 * Package Electron app into distributable installers using electron-builder.
 *
 * Usage:
 *   node scripts/dist-electron.mjs            # build + package for current platform
 *   node scripts/dist-electron.mjs --mac      # macOS (dmg + zip)
 *   node scripts/dist-electron.mjs --win      # Windows (nsis + zip)
 *   node scripts/dist-electron.mjs --linux    # Linux (AppImage + deb)
 *   node scripts/dist-electron.mjs --dir      # unpackaged directory (for testing)
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const electronPkg = resolve(root, 'packages/electron');

// Pass-through args (e.g. --mac, --win, --linux, --dir)
const extraArgs = process.argv.slice(2).join(' ');

// Check electron-builder is installed
const builderBin = resolve(electronPkg, 'node_modules/.bin/electron-builder');
const globalBin = resolve(root, 'node_modules/.bin/electron-builder');
if (!existsSync(builderBin) && !existsSync(globalBin)) {
  console.error('[dist] electron-builder not found. Install it first:');
  console.error('  pnpm add -D electron-builder --filter @promptstash/electron');
  process.exit(1);
}

// Step 1: Build Electron app (core + main + renderer + native rebuild)
console.log('[dist] Step 1/2 — Building Electron app...');
try {
  execSync('pnpm build:electron', { cwd: root, stdio: 'inherit' });
} catch {
  console.error('[dist] Build failed.');
  process.exit(1);
}

// Step 2: Package with electron-builder
// Prevent global ~/.npmrc electron_mirror (stale npm.taobao.org) from interfering.
// Electron binary download uses electronDownload.mirror in package.json build config.
// Auxiliary binaries (dmg-builder, etc.) should use the default GitHub URLs.
const builderEnv = { ...process.env };
delete builderEnv.npm_config_electron_mirror;
delete builderEnv['npm_config_electron-mirror'];
// Point npm userconfig to /dev/null so it won't read ~/.npmrc at all
builderEnv.npm_config_userconfig = '/dev/null';

console.log(`[dist] Step 2/2 — Packaging with electron-builder ${extraArgs || '(current platform)'}...`);
try {
  execSync(`npx electron-builder ${extraArgs}`, { cwd: electronPkg, stdio: 'inherit', env: builderEnv });
} catch {
  console.error('[dist] Packaging failed.');
  process.exit(1);
}

console.log('[dist] Done! Output → packages/electron/release/');
