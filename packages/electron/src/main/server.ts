import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Database } from '@promptstash/core';
import { PromptRepo, CategoryRepo, TagRepo, SettingsRepo, Classifier, LLMService, PromptGenerator, PromptOrganizer } from '@promptstash/core';
import type { PromptSearchParams, PromptCreateInput, PromptUpdateInput, LLMConfig, OrganizeApplyInput } from '@promptstash/core';
import { exportAll, importAll } from '@promptstash/core';

export async function createServer(db: Database, port = 9877) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  const prompts = new PromptRepo(db);
  const categories = new CategoryRepo(db);
  const tags = new TagRepo(db);
  const settings = new SettingsRepo(db);
  const classifier = new Classifier();

  let generator: PromptGenerator | null = null;
  function getGenerator(): PromptGenerator {
    if (!generator) {
      const llmConfig = settings.getLLMConfig();
      generator = new PromptGenerator(llmConfig);
    }
    return generator;
  }

  const cleanupInterval = setInterval(() => {
    generator?.cleanupExpired();
  }, 10 * 60 * 1000);

  app.addHook('onClose', async () => {
    clearInterval(cleanupInterval);
    generator?.cleanup();
  });

  // --- Categories ---
  app.get('/api/categories', async () => {
    return categories.listAll();
  });

  app.post<{ Body: { name: string; icon?: string } }>('/api/categories', async (request, reply) => {
    const { name, icon } = request.body;
    if (!name?.trim()) return reply.status(400).send({ error: 'Name is required' });
    const catList = categories.listAll();
    const maxSort = catList.reduce((max, c) => Math.max(max, c.sortOrder), 0);
    const created = categories.create({ name: name.trim(), icon, sortOrder: maxSort + 1 });
    return reply.status(201).send(created);
  });

  app.put<{ Params: { id: string }; Body: { name?: string; icon?: string; sortOrder?: number } }>('/api/categories/:id', async (request, reply) => {
    const updated = categories.update(request.params.id, request.body);
    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/api/categories/:id', async (request, reply) => {
    const success = categories.delete(request.params.id);
    if (!success) return reply.status(400).send({ error: 'Cannot delete this category' });
    return { ok: true };
  });

  // --- Tags ---
  app.get('/api/tags', async () => {
    return tags.listAll();
  });

  // --- Prompts ---
  app.get<{ Querystring: PromptSearchParams & { favorite?: string } }>('/api/prompts/search', async (request) => {
    const { q, categoryId, tag, favorite, limit, offset } = request.query;
    return prompts.search({
      q, categoryId, tag,
      favorite: favorite === 'true',
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
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

  app.put<{ Params: { id: string }; Body: PromptUpdateInput }>('/api/prompts/:id', async (request, reply) => {
    const updated = prompts.update(request.params.id, request.body);
    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return updated;
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

  // --- Import/Export ---
  app.get('/api/export', async () => {
    return exportAll(db);
  });

  app.post('/api/import', async (request) => {
    importAll(db, request.body as any);
    return { ok: true };
  });

  // --- Classify (LLM-powered with fallback) ---
  app.post<{ Body: { content: string } }>('/api/prompts/classify', async (request) => {
    const content = request.body.content;
    const catList = categories.listAll();
    const catNames = catList.map((c) => c.name);

    try {
      const llmConfig = settings.getLLMConfig();
      const llm = new LLMService(llmConfig);
      const result = await llm.classifyAndTitle(content, catNames);

      let categoryId = '';
      let isNewCategory = false;

      if (result.isNewCategory) {
        // Auto-create the new category
        const maxSort = catList.reduce((max, c) => Math.max(max, c.sortOrder), 0);
        const newCat = categories.create({ name: result.category, sortOrder: maxSort + 1 });
        categoryId = newCat.id;
        isNewCategory = true;
      } else {
        const matched = catList.find((c) => c.name === result.category);
        categoryId = matched?.id || '';
      }

      return {
        title: result.title,
        category: result.category,
        categoryId,
        tags: result.tags,
        isNewCategory,
      };
    } catch (err) {
      // Fallback to keyword classifier
      console.error('LLM classify failed, falling back to keyword classifier:', err);
      const result = classifier.classify(content);
      const title = classifier.suggestTitle(content);
      const matched = catList.find((c) => c.name === result.category);
      return {
        title,
        category: result.category,
        categoryId: matched?.id || '',
        tags: result.tags,
        isNewCategory: false,
        fallback: true,
      };
    }
  });

  // --- Settings ---
  app.get('/api/settings/llm', async () => {
    const config = settings.getLLMConfig();
    return {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey.replace(/^(.{4}).*(.{4})$/, '$1****$2'),
      model: config.model,
    };
  });

  app.put<{ Body: Partial<LLMConfig> }>('/api/settings/llm', async (request) => {
    settings.setLLMConfig(request.body);
    const config = settings.getLLMConfig();
    return {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey.replace(/^(.{4}).*(.{4})$/, '$1****$2'),
      model: config.model,
    };
  });

  // --- Generate (AI prompt generation) ---
  app.post<{ Body: { requirement: string } }>('/api/generate/start', async (request, reply) => {
    const { requirement } = request.body;
    if (!requirement?.trim()) return reply.status(400).send({ error: 'Requirement is required' });
    try {
      const currentConfig = settings.getLLMConfig();
      if (!generator || JSON.stringify(currentConfig) !== JSON.stringify((generator as any).config)) {
        generator = new PromptGenerator(currentConfig);
      }
      const result = await getGenerator().startSession(requirement.trim());
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Generation failed' });
    }
  });

  app.post<{ Body: { sessionId: string; feedback: string } }>('/api/generate/refine', async (request, reply) => {
    const { sessionId, feedback } = request.body;
    if (!sessionId || !feedback?.trim()) return reply.status(400).send({ error: 'sessionId and feedback are required' });
    try {
      const result = await getGenerator().refineSession(sessionId, feedback.trim());
      return result;
    } catch (err: any) {
      if (err.message === 'Session not found') return reply.status(404).send({ error: 'Session not found' });
      return reply.status(500).send({ error: err.message || 'Refinement failed' });
    }
  });

  app.post<{ Body: { sessionId: string } }>('/api/generate/save', async (request, reply) => {
    const { sessionId } = request.body;
    if (!sessionId) return reply.status(400).send({ error: 'sessionId is required' });
    const gen = getGenerator();
    const session = gen.getSession(sessionId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const catList = categories.listAll();
    const catNames = catList.map((c) => c.name);
    let categoryId = '';
    let tags: string[] = [];
    let title = '';

    try {
      const llmConfig = settings.getLLMConfig();
      const llm = new LLMService(llmConfig);
      const classifyResult = await llm.classifyAndTitle(session.generatedPrompt, catNames);
      if (classifyResult.isNewCategory) {
        const maxSort = catList.reduce((max, c) => Math.max(max, c.sortOrder), 0);
        const newCat = categories.create({ name: classifyResult.category, sortOrder: maxSort + 1 });
        categoryId = newCat.id;
      } else {
        const matched = catList.find((c) => c.name === classifyResult.category);
        categoryId = matched?.id || catList[0]?.id || '';
      }
      tags = classifyResult.tags;
      title = classifyResult.title;
    } catch {
      const classifyResult = classifier.classify(session.generatedPrompt);
      const matched = catList.find((c) => c.name === classifyResult.category);
      categoryId = matched?.id || catList[0]?.id || '';
      tags = classifyResult.tags;
      title = classifier.suggestTitle(session.generatedPrompt);
    }

    try {
      const lastAssistant = [...session.messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) {
        const parsed = JSON.parse(lastAssistant.content);
        if (parsed.title) title = parsed.title;
      }
    } catch { /* ignore */ }

    const created = prompts.create({
      title,
      content: session.generatedPrompt,
      categoryId,
      tags,
      source: 'ai-generated',
    });
    gen.deleteSession(sessionId);
    return reply.status(201).send(created);
  });

  app.delete<{ Params: { sessionId: string } }>('/api/generate/:sessionId', async (request) => {
    getGenerator().deleteSession(request.params.sessionId);
    return { ok: true };
  });

  // --- Organize (AI-powered prompt optimization) ---
  app.post('/api/organize/scan', async (_request, reply) => {
    try {
      const llmConfig = settings.getLLMConfig();
      const organizer = new PromptOrganizer(llmConfig);
      const allPrompts = prompts.search({});
      const catList = categories.listAll();
      const result = await organizer.scan(allPrompts, catList);
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Scan failed' });
    }
  });

  app.post<{ Body: OrganizeApplyInput }>('/api/organize/apply', async (request, reply) => {
    const { changes } = request.body;
    if (!changes?.length) return reply.status(400).send({ error: 'No changes provided' });

    let applied = 0;
    let failed = 0;
    const newCategoriesCreated: string[] = [];
    const catList = categories.listAll();

    for (const change of changes) {
      try {
        const update: Record<string, any> = {};
        if (change.newTitle) update.title = change.newTitle;
        if (change.newTags) update.tags = change.newTags;

        if (change.isNewCategory && change.newCategoryName) {
          const existing = catList.find(c => c.name === change.newCategoryName);
          if (existing) {
            update.categoryId = existing.id;
          } else {
            const maxSort = catList.reduce((max, c) => Math.max(max, c.sortOrder), 0);
            const newCat = categories.create({ name: change.newCategoryName, sortOrder: maxSort + 1 });
            catList.push(newCat);
            update.categoryId = newCat.id;
            newCategoriesCreated.push(change.newCategoryName);
          }
        } else if (change.newCategoryId) {
          update.categoryId = change.newCategoryId;
        } else if (change.newCategoryName) {
          const existing = catList.find(c => c.name === change.newCategoryName);
          if (existing) {
            update.categoryId = existing.id;
          }
        }

        if (Object.keys(update).length > 0) {
          prompts.update(change.promptId, update);
          applied++;
        }
      } catch {
        failed++;
      }
    }

    return { applied, failed, newCategoriesCreated };
  });

  return app;
}

export async function startServer(db: Database, port = 9877) {
  const app = await createServer(db, port);
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`PromptStash API running on http://127.0.0.1:${port}`);
  return app;
}
