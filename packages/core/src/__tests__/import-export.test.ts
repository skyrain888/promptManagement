import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { PromptRepo } from '../repositories/prompt-repo.js';
import { CategoryRepo } from '../repositories/category-repo.js';
import { exportAll, importAll } from '../import-export.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('Import/Export', () => {
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('should export and import data roundtrip', () => {
    const catRepo = new CategoryRepo(db);
    const promptRepo = new PromptRepo(db);

    const cat = catRepo.create({ name: '编程', sortOrder: 0 });
    promptRepo.create({ title: 'Test', content: 'Content', categoryId: cat.id, tags: ['python'] });

    const exported = exportAll(db);
    expect(exported.prompts).toHaveLength(1);
    expect(exported.categories).toHaveLength(1);

    // Import into fresh DB
    const dbPath2 = createTempDbPath();
    const db2 = new Database(dbPath2);
    importAll(db2, exported);

    const promptRepo2 = new PromptRepo(db2);
    const results = promptRepo2.search({});
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Test');

    db2.close();
    fs.unlinkSync(dbPath2);
    fs.rmdirSync(path.dirname(dbPath2));
  });
});
