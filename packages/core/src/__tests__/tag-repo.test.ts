import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { TagRepo } from '../repositories/tag-repo.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('TagRepo', () => {
  let db: Database;
  let repo: TagRepo;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
    repo = new TagRepo(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('should create and retrieve a tag', () => {
    const tag = repo.create({ name: 'python', color: '#3776AB' });
    expect(tag.name).toBe('python');
    const found = repo.getById(tag.id);
    expect(found).toEqual(tag);
  });

  it('should find or create a tag by name', () => {
    const tag1 = repo.findOrCreate('javascript');
    const tag2 = repo.findOrCreate('javascript');
    expect(tag1.id).toBe(tag2.id);
  });

  it('should list all tags', () => {
    repo.create({ name: 'python' });
    repo.create({ name: 'debug' });
    const all = repo.listAll();
    expect(all).toHaveLength(2);
  });
});
