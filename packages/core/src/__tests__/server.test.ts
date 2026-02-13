import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '@promptstash/electron/main/server.js';
import { Database } from '../db.js';
import { CategoryRepo } from '../repositories/category-repo.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('HTTP API Server', () => {
  let db: Database;
  let dbPath: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let categoryId: string;

  beforeAll(async () => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
    const catRepo = new CategoryRepo(db);
    const cat = catRepo.create({ name: '编程', sortOrder: 0 });
    categoryId = cat.id;
    server = await createServer(db);
  });

  afterAll(async () => {
    await server.close();
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('GET /api/categories should return categories', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/categories' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('编程');
  });

  it('POST /api/prompts should create a prompt', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/prompts',
      payload: {
        title: 'Test API Prompt',
        content: 'Some prompt content',
        categoryId,
        tags: ['test'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('Test API Prompt');
    expect(body.id).toBeTruthy();
  });

  it('GET /api/prompts/search should find prompts', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/prompts/search?q=API',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/prompts/classify should return suggestions', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/prompts/classify',
      payload: { content: 'Help me debug this Python function' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.category).toBe('编程');
    expect(body.tags).toContain('python');
  });
});
