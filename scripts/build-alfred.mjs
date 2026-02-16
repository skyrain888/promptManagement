#!/usr/bin/env node

/**
 * Build Alfred Workflow: compile TypeScript source to dist/
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const alfredPkg = resolve(root, 'packages/alfred-workflow');

console.log('Building Alfred Workflow...');

try {
  execSync('npx tsc --project tsconfig.json', { cwd: alfredPkg, stdio: 'inherit' });
  console.log('Build complete: packages/alfred-workflow/dist/');
} catch {
  console.error('Build failed');
  process.exit(1);
}
