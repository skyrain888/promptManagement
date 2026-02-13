import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('Database', () => {
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) fs.rmdirSync(dir);
  });

  it('should create tables on initialization', () => {
    const tables = db.listTables();
    expect(tables).toContain('prompts');
    expect(tables).toContain('categories');
    expect(tables).toContain('tags');
    expect(tables).toContain('prompt_tags');
  });

  it('should enable WAL mode', () => {
    const mode = db.getJournalMode();
    expect(mode).toBe('wal');
  });
});
