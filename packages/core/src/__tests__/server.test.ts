import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('category');
    expect(body).toHaveProperty('categoryId');
    expect(body).toHaveProperty('tags');
    expect(Array.isArray(body.tags)).toBe(true);
  });

  it('PUT /api/prompts/:id should update a prompt', async () => {
    // First create a prompt
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/prompts',
      payload: { title: 'To Update', content: 'Old content', categoryId, tags: ['old'] },
    });
    const created = createRes.json();

    const res = await server.inject({
      method: 'PUT',
      url: `/api/prompts/${created.id}`,
      payload: { title: 'Updated Title', tags: ['new'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe('Updated Title');
    expect(body.tags).toEqual(['new']);
    expect(body.content).toBe('Old content');
  });

  it('PUT /api/prompts/:id should return 404 for nonexistent', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/prompts/nonexistent',
      payload: { title: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/export should return all data', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/export' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(1);
    expect(body.categories).toBeDefined();
    expect(body.prompts).toBeDefined();
    expect(body.tags).toBeDefined();
  });

  it('POST /api/import should import data', async () => {
    // Export first
    const exportRes = await server.inject({ method: 'GET', url: '/api/export' });
    const data = exportRes.json();

    const res = await server.inject({
      method: 'POST',
      url: '/api/import',
      payload: data,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  // Add inside existing 'HTTP API Server' describe block, after the import test
  describe('Prompt Generation API', () => {
    let sessionId: string;

    beforeAll(() => {
      const originalFetch = globalThis.fetch;
      vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        if (urlStr.includes('/chat/completions')) {
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({ prompt: 'Generated prompt content', title: '生成的提示词' }) } }],
            }),
          } as Response;
        }
        return originalFetch(url, init);
      });
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('POST /api/generate/start should create a session', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/generate/start',
        payload: { requirement: '帮我写一个代码审查的提示词' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.sessionId).toBeTruthy();
      expect(body.prompt).toBeTruthy();
      expect(body.title).toBeTruthy();
      sessionId = body.sessionId;
    });

    it('POST /api/generate/refine should refine the prompt', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/generate/refine',
        payload: { sessionId, feedback: '请加上输出格式要求' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.sessionId).toBe(sessionId);
      expect(body.prompt).toBeTruthy();
    });

    it('POST /api/generate/refine should 404 for invalid session', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/generate/refine',
        payload: { sessionId: 'nonexistent', feedback: 'test' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('POST /api/generate/save should save prompt to database', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/generate/save',
        payload: { sessionId },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeTruthy();
      expect(body.title).toBeTruthy();
      expect(body.content).toBeTruthy();
      expect(body.categoryId).toBeTruthy();
    });

    it('DELETE /api/generate/:sessionId should delete session', async () => {
      const startRes = await server.inject({
        method: 'POST',
        url: '/api/generate/start',
        payload: { requirement: 'test' },
      });
      const newSessionId = startRes.json().sessionId;
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/generate/${newSessionId}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().ok).toBe(true);
    });
  });
});
