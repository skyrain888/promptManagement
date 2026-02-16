#!/usr/bin/env node

/**
 * Package Chrome extension into a distributable .zip file.
 *
 * Usage:
 *   node scripts/dist-extension.mjs
 *
 * Output: packages/chrome-extension/release/promptstash-extension-<version>.zip
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const extPkg = resolve(root, 'packages/chrome-extension');

const { version } = JSON.parse(readFileSync(resolve(extPkg, 'package.json'), 'utf8'));

// Step 1: Build
console.log('[dist] Step 1/2 — Building Chrome extension...');
try {
  execSync('pnpm build:extension', { cwd: root, stdio: 'inherit' });
} catch {
  console.error('[dist] Build failed.');
  process.exit(1);
}

// Step 2: Zip dist/ into release/
const releaseDir = resolve(extPkg, 'release');
mkdirSync(releaseDir, { recursive: true });

const zipName = `promptstash-extension-${version}.zip`;
const zipPath = resolve(releaseDir, zipName);

console.log(`[dist] Step 2/2 — Packaging into ${zipName}...`);
try {
  execSync(`cd dist && zip -r "${zipPath}" .`, { cwd: extPkg, stdio: 'inherit' });
} catch {
  console.error('[dist] Packaging failed.');
  process.exit(1);
}

console.log(`[dist] Done! Output → packages/chrome-extension/release/${zipName}`);
