#!/usr/bin/env node

/**
 * Install Alfred Workflow: build + symlink into Alfred's workflows directory.
 *
 * Usage:
 *   node scripts/install-alfred.mjs           # build & install (symlink)
 *   node scripts/install-alfred.mjs --uninstall  # remove symlink
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, lstatSync, symlinkSync, unlinkSync, readdirSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const alfredPkg = resolve(root, 'packages/alfred-workflow');

const BUNDLE_ID = 'com.promptstash.alfred';
const ALFRED_WORKFLOWS_DIR = resolve(
  process.env.HOME,
  'Library/Application Support/Alfred/Alfred.alfredpreferences/workflows'
);

const uninstall = process.argv.includes('--uninstall');

function findExistingWorkflow() {
  if (!existsSync(ALFRED_WORKFLOWS_DIR)) return null;

  for (const entry of readdirSync(ALFRED_WORKFLOWS_DIR)) {
    const plistPath = resolve(ALFRED_WORKFLOWS_DIR, entry, 'info.plist');
    if (!existsSync(plistPath)) continue;
    try {
      const content = readFileSync(plistPath, 'utf-8');
      if (content.includes(BUNDLE_ID)) {
        return resolve(ALFRED_WORKFLOWS_DIR, entry);
      }
    } catch {
      // skip unreadable plists
    }
  }
  return null;
}

function doUninstall() {
  const existing = findExistingWorkflow();
  if (existing) {
    const stat = lstatSync(existing);
    if (stat.isSymbolicLink()) {
      unlinkSync(existing);
      console.log(`Removed symlink: ${existing}`);
    } else {
      console.log(`Warning: ${existing} is not a symlink, skipping removal.`);
      console.log('Manually delete it if you want to remove the workflow.');
    }
  } else {
    console.log('PromptStash workflow not found in Alfred.');
  }
}

function doInstall() {
  // 1. Build
  console.log('Step 1: Building Alfred Workflow...');
  try {
    execSync('node scripts/build-alfred.mjs', { cwd: root, stdio: 'inherit' });
  } catch {
    process.exit(1);
  }

  // 2. Check Alfred directory
  if (!existsSync(ALFRED_WORKFLOWS_DIR)) {
    console.error(`Alfred workflows directory not found:\n  ${ALFRED_WORKFLOWS_DIR}`);
    console.error('Is Alfred installed?');
    process.exit(1);
  }

  // 3. Remove existing if any
  const existing = findExistingWorkflow();
  if (existing) {
    const stat = lstatSync(existing);
    if (stat.isSymbolicLink()) {
      unlinkSync(existing);
      console.log(`Removed existing symlink: ${existing}`);
    } else {
      console.error(`Existing non-symlink workflow found: ${existing}`);
      console.error('Remove it manually first, then re-run this script.');
      process.exit(1);
    }
  }

  // 4. Create symlink
  const linkPath = resolve(ALFRED_WORKFLOWS_DIR, `user.workflow.promptstash`);
  symlinkSync(alfredPkg, linkPath);
  console.log(`\nStep 2: Symlinked workflow:`);
  console.log(`  ${alfredPkg}`);
  console.log(`  → ${linkPath}`);

  console.log('\nInstall complete! Available triggers in Alfred:');
  console.log('  pp {query}  — Search prompts (Enter=copy, Cmd+Enter=paste)');
  console.log('  ps {title}  — Save clipboard content as prompt');
  console.log('\nNote: PromptStash desktop app must be running (HTTP API on port 9877).');
}

if (uninstall) {
  doUninstall();
} else {
  doInstall();
}
