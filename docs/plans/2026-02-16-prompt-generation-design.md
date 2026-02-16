# Prompt Generation & Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-turn AI prompt generation and optimization to PromptStash — users input requirements, system generates LLM-friendly prompts, users refine iteratively, then save.

**Architecture:** New `PromptGenerator` class in core package manages in-memory conversation sessions and calls existing `LLMService`. New Fastify API endpoints expose session lifecycle (start/refine/save/delete). Electron renderer gets a new "generate" mode panel.

**Tech Stack:** TypeScript, Vitest, Fastify, OpenAI-compatible LLM API, React 19, Tailwind v4

---

### Task 1: Add data model types

**Files:**
- Modify: `packages/core/src/models.ts:64` (append after existing types)

**Step 1: Add the new types to models.ts**

Append these types after the existing `LLMClassifyResult` interface:

```typescript
export interface GenerateSession {
  id: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  generatedPrompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface GenerateStartInput {
  requirement: string;
}

export interface GenerateRefineInput {
  sessionId: string;
  feedback: string;
}

export interface GenerateResult {
  sessionId: string;
  prompt: string;
  title: string;
}

export interface GenerateSaveInput {
  sessionId: string;
}
```

**Step 2: Commit**

```bash
git add packages/core/src/models.ts
git commit -m "feat(core): add prompt generation data model types"
```

---

### Task 2: Write PromptGenerator unit tests (TDD - tests first)

**Files:**
- Create: `packages/core/src/__tests__/prompt-generator.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptGenerator } from '../prompt-generator.js';
import type { LLMConfig } from '../models.js';

const mockConfig: LLMConfig = {
  baseUrl: 'https://fake-llm.test/v1',
  apiKey: 'sk-test-key',
  model: 'test-model',
};

// Mock fetch globally
const mockFetch = vi.fn();

describe('PromptGenerator', () => {
  let generator: PromptGenerator;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    generator = new PromptGenerator(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    generator.cleanup();
  });

  function mockLLMResponse(content: string) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content } }],
      }),
    });
  }

  describe('startSession', () => {
    it('should create a session and return generated prompt', async () => {
      const responseJson = JSON.stringify({
        prompt: '# Role: Python Expert\n\nYou are a Python expert...',
        title: 'Python代码审查助手',
      });
      mockLLMResponse(responseJson);

      const result = await generator.startSession('帮我写一个Python代码审查的提示词');

      expect(result.sessionId).toBeTruthy();
      expect(result.prompt).toBe('# Role: Python Expert\n\nYou are a Python expert...');
      expect(result.title).toBe('Python代码审查助手');
    });

    it('should send correct messages to LLM API', async () => {
      const responseJson = JSON.stringify({ prompt: 'test prompt', title: '测试' });
      mockLLMResponse(responseJson);

      await generator.startSession('测试需求');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
      expect(callArgs.messages[1].content).toContain('测试需求');
    });

    it('should throw on LLM API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(generator.startSession('test')).rejects.toThrow('LLM API error 500');
    });
  });

  describe('refineSession', () => {
    it('should refine an existing session with feedback', async () => {
      // Start session first
      const startJson = JSON.stringify({ prompt: 'initial prompt', title: '初始' });
      mockLLMResponse(startJson);
      const { sessionId } = await generator.startSession('需求');

      // Refine
      const refineJson = JSON.stringify({ prompt: 'refined prompt', title: '优化后' });
      mockLLMResponse(refineJson);
      const result = await generator.refineSession(sessionId, '请加上输出格式要求');

      expect(result.prompt).toBe('refined prompt');
      expect(result.title).toBe('优化后');
    });

    it('should accumulate messages in conversation history', async () => {
      const startJson = JSON.stringify({ prompt: 'v1', title: 't1' });
      mockLLMResponse(startJson);
      const { sessionId } = await generator.startSession('需求');

      const refineJson = JSON.stringify({ prompt: 'v2', title: 't2' });
      mockLLMResponse(refineJson);
      await generator.refineSession(sessionId, '更简洁');

      // Check the second call has accumulated messages
      const secondCallArgs = JSON.parse(mockFetch.mock.calls[1][1].body);
      // system + user1 + assistant1 + user2 = 4 messages
      expect(secondCallArgs.messages).toHaveLength(4);
    });

    it('should throw for nonexistent session', async () => {
      await expect(generator.refineSession('nonexistent', 'feedback')).rejects.toThrow('Session not found');
    });
  });

  describe('getSession', () => {
    it('should return session state', async () => {
      const responseJson = JSON.stringify({ prompt: 'test', title: '测试' });
      mockLLMResponse(responseJson);
      const { sessionId } = await generator.startSession('需求');

      const session = generator.getSession(sessionId);
      expect(session).toBeTruthy();
      expect(session!.generatedPrompt).toBe('test');
    });

    it('should return undefined for nonexistent session', () => {
      expect(generator.getSession('nonexistent')).toBeUndefined();
    });
  });

  describe('deleteSession', () => {
    it('should remove session', async () => {
      const responseJson = JSON.stringify({ prompt: 'test', title: '测试' });
      mockLLMResponse(responseJson);
      const { sessionId } = await generator.startSession('需求');

      generator.deleteSession(sessionId);
      expect(generator.getSession(sessionId)).toBeUndefined();
    });
  });

  describe('session expiry', () => {
    it('should clean up expired sessions', async () => {
      const responseJson = JSON.stringify({ prompt: 'test', title: '测试' });
      mockLLMResponse(responseJson);
      const { sessionId } = await generator.startSession('需求');

      // Manually expire the session by setting updatedAt to past
      const session = generator.getSession(sessionId)!;
      session.updatedAt = Date.now() - 31 * 60 * 1000; // 31 minutes ago

      generator.cleanupExpired();
      expect(generator.getSession(sessionId)).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm --filter @promptstash/core test -- prompt-generator.test.ts`

Expected: FAIL — module `../prompt-generator.js` not found

**Step 3: Commit test file**

```bash
git add packages/core/src/__tests__/prompt-generator.test.ts
git commit -m "test(core): add prompt generator unit tests (red phase)"
```

---

### Task 3: Implement PromptGenerator class

**Files:**
- Create: `packages/core/src/prompt-generator.ts`
- Modify: `packages/core/src/index.ts` (add export)

**Step 1: Create prompt-generator.ts**

```typescript
import { randomUUID } from 'node:crypto';
import type { LLMConfig, GenerateSession, GenerateResult } from './models.js';

const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

const SYSTEM_PROMPT = `你是一个专业的提示词工程师。你的任务是根据用户描述的需求，生成高质量的、对大语言模型友好的提示词。

生成的提示词应包含以下要素（根据需求灵活选择）：
1. **角色定义**：明确 AI 应扮演的角色
2. **任务目标**：清晰描述需要完成的任务
3. **约束条件**：输出的限制和要求
4. **输出格式**：期望的输出结构
5. **示例**（如适用）：输入输出示例

要求：
- 提示词应清晰、结构化、无歧义
- 使用 Markdown 格式组织提示词
- 提示词语言与用户需求描述的语言一致
- 不要包含解释说明，只输出提示词本身

严格以 JSON 格式返回: {"prompt": "生成的提示词内容", "title": "简洁的中文标题(10字以内)"}`;

export class PromptGenerator {
  private sessions = new Map<string, GenerateSession>();
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async startSession(requirement: string): Promise<GenerateResult> {
    const sessionId = randomUUID();
    const now = Date.now();

    const messages: GenerateSession['messages'] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `我的需求：${requirement}` },
    ];

    const { prompt, title } = await this.callLLM(messages);

    const session: GenerateSession = {
      id: sessionId,
      messages: [
        ...messages,
        { role: 'assistant', content: JSON.stringify({ prompt, title }) },
      ],
      generatedPrompt: prompt,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    return { sessionId, prompt, title };
  }

  async refineSession(sessionId: string, feedback: string): Promise<GenerateResult> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.messages.push({ role: 'user', content: feedback });

    const { prompt, title } = await this.callLLM(session.messages);

    session.messages.push({ role: 'assistant', content: JSON.stringify({ prompt, title }) });
    session.generatedPrompt = prompt;
    session.updatedAt = Date.now();

    return { sessionId, prompt, title };
  }

  getSession(sessionId: string): GenerateSession | undefined {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.updatedAt > SESSION_EXPIRY_MS) {
        this.sessions.delete(id);
      }
    }
  }

  cleanup(): void {
    this.sessions.clear();
  }

  private async callLLM(messages: GenerateSession['messages']): Promise<{ prompt: string; title: string }> {
    const url = `${this.config.baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM API error ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('LLM returned empty response');

    const parsed = JSON.parse(raw) as { prompt: string; title: string };
    if (!parsed.prompt) throw new Error('LLM response missing prompt field');

    return {
      prompt: parsed.prompt,
      title: parsed.title || '未命名提示词',
    };
  }
}
```

**Step 2: Add export to index.ts**

Add to `packages/core/src/index.ts`:

```typescript
export { PromptGenerator } from './prompt-generator.js';
export type { GenerateSession, GenerateStartInput, GenerateRefineInput, GenerateResult, GenerateSaveInput } from './models.js';
```

**Step 3: Run tests to verify they pass**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm --filter @promptstash/core test -- prompt-generator.test.ts`

Expected: All tests PASS

**Step 4: Run full test suite to check nothing is broken**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm test`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/core/src/prompt-generator.ts packages/core/src/index.ts packages/core/src/models.ts
git commit -m "feat(core): implement PromptGenerator with multi-turn session management"
```

---

### Task 4: Write API integration tests (TDD - tests first)

**Files:**
- Modify: `packages/core/src/__tests__/server.test.ts` (add new describe block)

**Step 1: Add generate API tests to server.test.ts**

Append a new `describe` block inside the existing outer `describe('HTTP API Server', ...)`, after the import test:

```typescript
  // --- Generate (prompt generation) ---
  describe('Prompt Generation API', () => {
    let sessionId: string;

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
      // Create a new session first
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
```

**Important:** These tests will use the real `PromptGenerator` which calls LLM via fetch. Since the test runs without a real LLM, the classify endpoint already falls back to the keyword classifier. For the generate endpoints, the server needs to handle LLM errors gracefully. We will need to mock fetch in the server test setup OR make the server create `PromptGenerator` with a mock-friendly approach.

**Approach:** In the server, we'll make `PromptGenerator` injectable so tests can provide a mock. But for simplicity in the server tests, we'll use `vi.stubGlobal('fetch', ...)` at the top of the generate tests describe block to mock LLM responses.

Update the generate test block to include fetch mocking:

```typescript
  describe('Prompt Generation API', () => {
    let sessionId: string;

    beforeAll(() => {
      // Mock fetch for LLM calls (generate endpoints)
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

    // ... test cases as above ...
  });
```

Add `vi` to the imports at top of file:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm --filter @promptstash/core test -- server.test.ts`

Expected: FAIL — routes not registered yet

**Step 3: Commit**

```bash
git add packages/core/src/__tests__/server.test.ts
git commit -m "test(core): add prompt generation API integration tests (red phase)"
```

---

### Task 5: Add generate API endpoints to server

**Files:**
- Modify: `packages/electron/src/main/server.ts`

**Step 1: Add generate routes to server.ts**

Add import for `PromptGenerator` at the top of server.ts:

```typescript
import { PromptRepo, CategoryRepo, TagRepo, SettingsRepo, Classifier, LLMService, PromptGenerator } from '@promptstash/core';
```

Add `PromptGenerator` and `GenerateResult` type imports. Then inside `createServer()`, after `const classifier = new Classifier();` line, add:

```typescript
  // --- Prompt Generator (lazy init) ---
  let generator: PromptGenerator | null = null;
  function getGenerator(): PromptGenerator {
    if (!generator) {
      const llmConfig = settings.getLLMConfig();
      generator = new PromptGenerator(llmConfig);
    }
    return generator;
  }

  // Clean up expired sessions every 10 minutes
  const cleanupInterval = setInterval(() => {
    generator?.cleanupExpired();
  }, 10 * 60 * 1000);

  app.addHook('onClose', async () => {
    clearInterval(cleanupInterval);
    generator?.cleanup();
  });
```

Then add the generate endpoints before the `return app;` line:

```typescript
  // --- Generate (AI prompt generation) ---
  app.post<{ Body: { requirement: string } }>('/api/generate/start', async (request, reply) => {
    const { requirement } = request.body;
    if (!requirement?.trim()) return reply.status(400).send({ error: 'Requirement is required' });
    try {
      // Re-create generator if LLM config changed
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

    // Auto-classify the generated prompt
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
      // Fallback to keyword classifier
      const classifyResult = classifier.classify(session.generatedPrompt);
      const matched = catList.find((c) => c.name === classifyResult.category);
      categoryId = matched?.id || catList[0]?.id || '';
      tags = classifyResult.tags;
      title = classifier.suggestTitle(session.generatedPrompt);
    }

    // Use the generator's title if classification doesn't provide one
    // Extract title from the last assistant message
    try {
      const lastAssistant = [...session.messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) {
        const parsed = JSON.parse(lastAssistant.content);
        if (parsed.title) title = parsed.title;
      }
    } catch {
      // ignore parse errors
    }

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
```

**Step 2: Run server tests to verify they pass**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm --filter @promptstash/core test -- server.test.ts`

Expected: All tests PASS

**Step 3: Run full test suite**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm test`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add packages/electron/src/main/server.ts
git commit -m "feat(server): add prompt generation API endpoints (start/refine/save/delete)"
```

---

### Task 6: Build and verify the Electron app compiles

**Step 1: Build core package**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm --filter @promptstash/core build`

Expected: Build succeeds

**Step 2: Build Electron main process**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm build:electron`

Expected: Build succeeds without errors. The esbuild step should bundle `PromptGenerator` from core.

**Step 3: Rebuild better-sqlite3 for system Node (required before tests after Electron build)**

Run: `npx --yes node-gyp rebuild --directory=node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3`

**Step 4: Run full test suite to confirm**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm test`

Expected: All tests PASS

**Step 5: Commit**

```bash
git commit --allow-empty -m "chore: verify Electron build with prompt generation feature"
```

---

### Task 7: Add Generate panel UI to Electron renderer

**Files:**
- Modify: `packages/electron/src/renderer/App.tsx`

**Step 1: Add a `SparkleIcon` component**

Add after the `GearIcon` component (around line 99):

```typescript
function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
    </svg>
  );
}
```

**Step 2: Add `GeneratePanel` component**

Add before the `App()` function:

```typescript
function GeneratePanel({ categories, onSaved, onClose }: {
  categories: Category[];
  onSaved: (prompt: Prompt) => void;
  onClose: () => void;
}) {
  const [requirement, setRequirement] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleGenerate = async () => {
    if (!requirement.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/generate/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: requirement.trim() }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Generation failed');
      }
      const data = await r.json();
      setSessionId(data.sessionId);
      setGeneratedPrompt(data.prompt);
      setGeneratedTitle(data.title);
      setHistory([
        { role: 'user', content: requirement.trim() },
        { role: 'assistant', content: data.prompt },
      ]);
    } catch (err: any) {
      setError(err.message || '生成失败');
    }
    setLoading(false);
  };

  const handleRefine = async () => {
    if (!feedback.trim() || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/generate/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, feedback: feedback.trim() }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Refinement failed');
      }
      const data = await r.json();
      setGeneratedPrompt(data.prompt);
      setGeneratedTitle(data.title);
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: feedback.trim() },
        { role: 'assistant', content: data.prompt },
      ]);
      setFeedback('');
    } catch (err: any) {
      setError(err.message || '优化失败');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!sessionId) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/generate/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Save failed');
      }
      const saved = await r.json();
      onSaved(saved);
    } catch (err: any) {
      setError(err.message || '保存失败');
    }
    setSaving(false);
  };

  const handleRestart = () => {
    if (sessionId) {
      fetch(`${API}/api/generate/${sessionId}`, { method: 'DELETE' });
    }
    setSessionId(null);
    setGeneratedPrompt('');
    setGeneratedTitle('');
    setFeedback('');
    setRequirement('');
    setHistory([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">AI 生成提示词</h2>
        <button onClick={onClose} className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          关闭
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
        {!sessionId ? (
          /* Input phase */
          <>
            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-medium text-gray-500 mb-1">描述你的需求</label>
              <textarea
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                className="flex-1 min-h-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-none"
                placeholder="例如：帮我写一个代码审查助手的提示词，要求关注代码质量、安全性和性能..."
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleGenerate(); }}
              />
            </div>
            <p className="text-[11px] text-gray-400">Cmd+Enter 快速生成</p>
          </>
        ) : (
          /* Result + refinement phase */
          <>
            {/* Conversation history */}
            <div className="flex flex-col gap-3">
              {history.map((msg, i) => (
                <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {msg.role === 'user' ? (
                    <div className="inline-block bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg max-w-[90%] text-left">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">{msg.content}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Feedback input */}
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">优化建议</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRefine(); }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  placeholder="例如：更简洁、加上输出格式、增加示例..."
                  disabled={loading}
                />
                <button
                  onClick={handleRefine}
                  disabled={!feedback.trim() || loading}
                  className="shrink-0 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '优化中...' : '优化'}
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700">{error}</div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
        {!sessionId ? (
          <button
            onClick={handleGenerate}
            disabled={!requirement.trim() || loading}
            className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '生成中...' : '生成提示词'}
          </button>
        ) : (
          <>
            <button
              onClick={handleRestart}
              disabled={loading || saving}
              className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              重新开始
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Update App component mode type and add generate button**

In the `App()` function, update the `mode` state type:

```typescript
const [mode, setMode] = useState<'view' | 'create' | 'edit' | 'settings' | 'generate'>('view');
```

Add a "Generate" button in the toolbar area, next to the existing "+" (create) button (around line 908-914 in the search bar section):

```tsx
          <button
            onClick={() => { setMode('generate'); setSelectedPrompt(null); }}
            className="shrink-0 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            title="AI 生成提示词"
          >
            <SparkleIcon />
          </button>
```

**Step 4: Add the generate panel rendering in the right panel area**

After the settings panel render block (after line ~1087), add:

```tsx
      {mode === 'generate' && (
        <aside className="w-[340px] bg-white border-l border-gray-200/60 flex flex-col">
          <GeneratePanel
            categories={categories}
            onSaved={(saved) => {
              setMode('view');
              setSelectedPrompt(saved);
              refreshPrompts();
              fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
            }}
            onClose={() => setMode('view')}
          />
        </aside>
      )}
```

**Step 5: Build and verify**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm build:electron`

Expected: Build succeeds

**Step 6: Rebuild better-sqlite3 for system Node**

Run: `npx --yes node-gyp rebuild --directory=node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3`

**Step 7: Run full test suite**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm test`

Expected: All tests PASS

**Step 8: Commit**

```bash
git add packages/electron/src/renderer/App.tsx
git commit -m "feat(ui): add AI prompt generation panel with multi-turn refinement"
```

---

### Task 8: Final integration test and cleanup

**Step 1: Run full test suite one final time**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm test`

Expected: All tests PASS

**Step 2: Build everything to confirm production builds work**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm build:electron`

Expected: Build succeeds

**Step 3: Update CLAUDE.md with new API endpoints**

Add the generate endpoints to the API table in `CLAUDE.md`:

```markdown
| POST | `/api/generate/start` | Start prompt generation session |
| POST | `/api/generate/refine` | Refine with feedback |
| POST | `/api/generate/save` | Save generated prompt |
| DELETE | `/api/generate/:sessionId` | Discard session |
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add prompt generation API endpoints to CLAUDE.md"
```
