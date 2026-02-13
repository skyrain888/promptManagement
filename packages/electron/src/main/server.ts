import Fastify from 'fastify';
import type { Database } from '@promptstash/core';
import { PromptRepo, CategoryRepo, TagRepo, Classifier } from '@promptstash/core';
import type { PromptSearchParams, PromptCreateInput } from '@promptstash/core';

export async function createServer(db: Database, port = 9877) {
  const app = Fastify({ logger: false });

  const prompts = new PromptRepo(db);
  const categories = new CategoryRepo(db);
  const tags = new TagRepo(db);
  const classifier = new Classifier();

  // --- Categories ---
  app.get('/api/categories', async () => {
    return categories.listAll();
  });

  // --- Tags ---
  app.get('/api/tags', async () => {
    return tags.listAll();
  });

  // --- Prompts ---
  app.get<{ Querystring: PromptSearchParams }>('/api/prompts/search', async (request) => {
    const { q, categoryId, tag, limit, offset } = request.query;
    return prompts.search({ q, categoryId, tag, limit: limit ? Number(limit) : undefined, offset: offset ? Number(offset) : undefined });
  });

  app.get<{ Params: { id: string } }>('/api/prompts/:id', async (request, reply) => {
    const prompt = prompts.getById(request.params.id);
    if (!prompt) return reply.status(404).send({ error: 'Not found' });
    return prompt;
  });

  app.post<{ Body: PromptCreateInput }>('/api/prompts', async (request, reply) => {
    const created = prompts.create(request.body);
    return reply.status(201).send(created);
  });

  app.post<{ Params: { id: string } }>('/api/prompts/:id/use', async (request) => {
    prompts.incrementUsage(request.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/prompts/:id/favorite', async (request) => {
    prompts.toggleFavorite(request.params.id);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/prompts/:id', async (request) => {
    prompts.delete(request.params.id);
    return { ok: true };
  });

  // --- Classify ---
  app.post<{ Body: { content: string } }>('/api/prompts/classify', async (request) => {
    const result = classifier.classify(request.body.content);
    const title = classifier.suggestTitle(request.body.content);
    return { ...result, suggestedTitle: title };
  });

  return app;
}

export async function startServer(db: Database, port = 9877) {
  const app = await createServer(db, port);
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`PromptStash API running on http://127.0.0.1:${port}`);
  return app;
}
