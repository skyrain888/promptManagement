import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { CategoryRepo } from '../repositories/category-repo.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('CategoryRepo', () => {
  let db: Database;
  let repo: CategoryRepo;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
    repo = new CategoryRepo(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('should create and retrieve a category', () => {
    const cat = repo.create({ name: '编程', icon: '💻', sortOrder: 0 });
    expect(cat.name).toBe('编程');
    expect(cat.id).toBeTruthy();

    const found = repo.getById(cat.id);
    expect(found).toEqual(cat);
  });

  it('should list all categories ordered by sortOrder', () => {
    repo.create({ name: '写作', sortOrder: 2 });
    repo.create({ name: '编程', sortOrder: 0 });
    repo.create({ name: '翻译', sortOrder: 1 });

    const all = repo.listAll();
    expect(all.map((c) => c.name)).toEqual(['编程', '翻译', '写作']);
  });

  it('should seed default categories', () => {
    repo.seedDefaults();
    const all = repo.listAll();
    expect(all.length).toBeGreaterThanOrEqual(4);
  });
});
