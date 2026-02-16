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

  describe('update', () => {
    it('should update title and content', () => {
      const p = prompts.create({ title: 'Original', content: 'Original content', categoryId });
      const updated = prompts.update(p.id, { title: 'Updated', content: 'New content' });
      expect(updated).toBeTruthy();
      expect(updated!.title).toBe('Updated');
      expect(updated!.content).toBe('New content');
      expect(updated!.categoryId).toBe(categoryId);
    });

    it('should update tags', () => {
      const p = prompts.create({ title: 'Test', content: 'Content', categoryId, tags: ['old'] });
      const updated = prompts.update(p.id, { tags: ['new1', 'new2'] });
      expect(updated!.tags).toHaveLength(2);
      expect(updated!.tags).toContain('new1');
      expect(updated!.tags).toContain('new2');
    });

    it('should update category', () => {
      const cat2 = categories.create({ name: '写作', sortOrder: 1 });
      const p = prompts.create({ title: 'Test', content: 'Content', categoryId });
      const updated = prompts.update(p.id, { categoryId: cat2.id });
      expect(updated!.categoryId).toBe(cat2.id);
    });

    it('should return undefined for nonexistent id', () => {
      const result = prompts.update('nonexistent', { title: 'X' });
      expect(result).toBeUndefined();
    });
  });

  describe('favorite search', () => {
    it('should return manually favorited prompts', () => {
      const p1 = prompts.create({ title: 'Fav', content: 'Content', categoryId });
      prompts.create({ title: 'Normal', content: 'Content', categoryId });
      prompts.toggleFavorite(p1.id);

      const results = prompts.search({ favorite: true });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(p1.id);
    });

    it('should return frequently used prompts (usage >= threshold)', () => {
      const p1 = prompts.create({ title: 'Popular', content: 'Content', categoryId });
      prompts.create({ title: 'Rare', content: 'Content', categoryId });

      for (let i = 0; i < PromptRepo.FREQUENT_USE_THRESHOLD; i++) {
        prompts.incrementUsage(p1.id);
      }

      const results = prompts.search({ favorite: true });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(p1.id);
    });

    it('should return both favorited and frequently used prompts', () => {
      const p1 = prompts.create({ title: 'Manual fav', content: 'Content', categoryId });
      const p2 = prompts.create({ title: 'Auto fav', content: 'Content', categoryId });
      prompts.create({ title: 'Neither', content: 'Content', categoryId });

      prompts.toggleFavorite(p1.id);
      for (let i = 0; i < PromptRepo.FREQUENT_USE_THRESHOLD; i++) {
        prompts.incrementUsage(p2.id);
      }

      const results = prompts.search({ favorite: true });
      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain(p1.id);
      expect(ids).toContain(p2.id);
    });

    it('should not return favorites when favorite param is not set', () => {
      const p1 = prompts.create({ title: 'Fav', content: 'Content', categoryId });
      const p2 = prompts.create({ title: 'Normal', content: 'Content', categoryId });
      prompts.toggleFavorite(p1.id);

      const results = prompts.search({});
      expect(results).toHaveLength(2);
    });

    it('should combine favorite filter with text search', () => {
      const p1 = prompts.create({ title: 'Python fav', content: 'Python code', categoryId });
      const p2 = prompts.create({ title: 'Python normal', content: 'Python code', categoryId });
      prompts.toggleFavorite(p1.id);

      const results = prompts.search({ q: 'Python', favorite: true });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(p1.id);
    });
  });
});
