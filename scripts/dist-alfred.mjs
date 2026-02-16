#!/usr/bin/env node

/**
 * Package Alfred Workflow into a distributable .alfredworkflow file.
 * (.alfredworkflow is a zip containing info.plist + dist/ + icon.png)
 *
 * Usage:
 *   node scripts/dist-alfred.mjs
 *
 * Output: packages/alfred-workflow/release/PromptStash-<version>.alfredworkflow
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const alfredPkg = resolve(root, 'packages/alfred-workflow');

const { version } = JSON.parse(readFileSync(resolve(alfredPkg, 'package.json'), 'utf8'));

// Step 1: Build
console.log('[dist] Step 1/2 — Building Alfred Workflow...');
try {
  execSync('pnpm build:alfred', { cwd: root, stdio: 'inherit' });
} catch {
  console.error('[dist] Build failed.');
  process.exit(1);
}

// Step 2: Zip into .alfredworkflow
const releaseDir = resolve(alfredPkg, 'release');
mkdirSync(releaseDir, { recursive: true });

const zipName = `PromptStash-${version}.alfredworkflow`;
const zipPath = resolve(releaseDir, zipName);

// Collect files to include: info.plist (required), dist/, icon.png (optional)
const includes = ['info.plist', 'dist'];
if (existsSync(resolve(alfredPkg, 'icon.png'))) {
  includes.push('icon.png');
}

console.log(`[dist] Step 2/2 — Packaging into ${zipName}...`);
try {
  execSync(`zip -r "${zipPath}" ${includes.join(' ')}`, { cwd: alfredPkg, stdio: 'inherit' });
} catch {
  console.error('[dist] Packaging failed.');
  process.exit(1);
}

console.log(`[dist] Done! Output → packages/alfred-workflow/release/${zipName}`);
