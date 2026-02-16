import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { CategoryRepo } from '../repositories/category-repo.js';
import { PromptRepo } from '../repositories/prompt-repo.js';
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

  it('should update a category', () => {
    const cat = repo.create({ name: '编程', icon: '💻', sortOrder: 0 });
    const updated = repo.update(cat.id, { name: '开发', icon: '🛠️' });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('开发');
    expect(updated!.icon).toBe('🛠️');
    expect(updated!.sortOrder).toBe(0); // unchanged

    const found = repo.getById(cat.id);
    expect(found!.name).toBe('开发');
  });

  it('should return undefined when updating non-existent category', () => {
    const result = repo.update('nonexistent', { name: 'test' });
    expect(result).toBeUndefined();
  });

  it('should delete a category and reassign prompts to 其他', () => {
    repo.seedDefaults();
    const cats = repo.listAll();
    const codingCat = cats.find((c) => c.name === '编程')!;
    const otherCat = cats.find((c) => c.name === '其他')!;

    // Create a prompt in the coding category
    const promptRepo = new PromptRepo(db);
    const prompt = promptRepo.create({
      title: 'Test prompt',
      content: 'Test content',
      categoryId: codingCat.id,
    });

    // Delete the coding category
    const success = repo.delete(codingCat.id);
    expect(success).toBe(true);
    expect(repo.getById(codingCat.id)).toBeUndefined();

    // Prompt should now be in 其他
    const movedPrompt = promptRepo.getById(prompt.id);
    expect(movedPrompt!.categoryId).toBe(otherCat.id);
  });

  it('should not allow deleting 其他 category', () => {
    repo.seedDefaults();
    const cats = repo.listAll();
    const otherCat = cats.find((c) => c.name === '其他')!;

    const success = repo.delete(otherCat.id);
    expect(success).toBe(false);
    expect(repo.getById(otherCat.id)).toBeDefined();
  });
});
