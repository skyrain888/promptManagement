import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { PromptRepo } from '../repositories/prompt-repo.js';
import { CategoryRepo } from '../repositories/category-repo.js';
import { TagRepo } from '../repositories/tag-repo.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('PromptRepo', () => {
  let db: Database;
  let prompts: PromptRepo;
  let categories: CategoryRepo;
  let tags: TagRepo;
  let dbPath: string;
  let categoryId: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
    prompts = new PromptRepo(db);
    categories = new CategoryRepo(db);
    tags = new TagRepo(db);
    const cat = categories.create({ name: '编程', sortOrder: 0 });
    categoryId = cat.id;
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('should create a prompt with tags', () => {
    const prompt = prompts.create({
      title: 'Debug Python',
      content: 'Help me debug this Python code...',
      categoryId,
      tags: ['python', 'debug'],
      source: 'chatgpt.com',
    });
    expect(prompt.id).toBeTruthy();
    expect(prompt.tags).toEqual(['python', 'debug']);
    expect(prompt.usageCount).toBe(0);
  });

  it('should get a prompt by id with tags', () => {
    const created = prompts.create({
      title: 'Test Prompt',
      content: 'Content here',
      categoryId,
      tags: ['test'],
    });
    const found = prompts.getById(created.id);
    expect(found).toBeTruthy();
    expect(found!.title).toBe('Test Prompt');
    expect(found!.tags).toEqual(['test']);
  });

  it('should full-text search prompts', () => {
    prompts.create({ title: 'Python debugging', content: 'Fix errors in Python', categoryId });
    prompts.create({ title: 'React components', content: 'Build UI with React', categoryId });

    const results = prompts.search({ q: 'Python' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Python debugging');
  });

  it('should filter by category', () => {
    const cat2 = categories.create({ name: '写作', sortOrder: 1 });
    prompts.create({ title: 'Prompt A', content: 'Content A', categoryId });
    prompts.create({ title: 'Prompt B', content: 'Content B', categoryId: cat2.id });

    const results = prompts.search({ categoryId });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Prompt A');
  });

  it('should increment usage count', () => {
    const p = prompts.create({ title: 'Test', content: 'Content', categoryId });
    prompts.incrementUsage(p.id);
    prompts.incrementUsage(p.id);
    const updated = prompts.getById(p.id);
    expect(updated!.usageCount).toBe(2);
  });

  it('should toggle favorite', () => {
    const p = prompts.create({ title: 'Test', content: 'Content', categoryId });
    expect(p.isFavorite).toBe(false);
    prompts.toggleFavorite(p.id);
    expect(prompts.getById(p.id)!.isFavorite).toBe(true);
    prompts.toggleFavorite(p.id);
    expect(prompts.getById(p.id)!.isFavorite).toBe(false);
  });

  it('should delete a prompt', () => {
    const p = prompts.create({ title: 'Test', content: 'Content', categoryId });
    prompts.delete(p.id);
    expect(prompts.getById(p.id)).toBeUndefined();
  });
});
