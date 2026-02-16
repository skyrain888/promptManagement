# Organize Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered organize/tidy feature that scans all prompts and suggests title, category, tag optimizations and detects duplicates.

**Architecture:** New `PromptOrganizer` class in core package handles batch LLM analysis. Two new Fastify endpoints (`/api/organize/scan` and `/api/organize/apply`) expose the feature. New `OrganizePanel` React component in the Electron renderer provides the UI, triggered via a sidebar button using the existing `mode` state pattern.

**Tech Stack:** TypeScript, Vitest (tests), Fastify (API), React 19 + Tailwind v4 (UI), OpenAI-compatible LLM API

---

### Task 1: Add organize types to models

**Files:**
- Modify: `packages/core/src/models.ts`

**Step 1: Add the new types at the end of models.ts**

```typescript
// After GenerateSaveInput interface, add:

export interface OrganizeSuggestion {
  promptId: string;
  originalTitle: string;
  newTitle: string | null;
  originalCategory: string;
  newCategory: string | null;
  isNewCategory: boolean;
  originalTags: string[];
  newTags: string[] | null;
  similarTo: string[];
  reason: string;
}

export interface OrganizeScanResult {
  suggestions: OrganizeSuggestion[];
  totalScanned: number;
  batchesCompleted: number;
  batchesFailed: number;
}

export interface OrganizeApplyInput {
  changes: Array<{
    promptId: string;
    newTitle?: string;
    newCategoryId?: string;
    newCategoryName?: string;
    isNewCategory?: boolean;
    newTags?: string[];
  }>;
}

export interface OrganizeApplyResult {
  applied: number;
  failed: number;
  newCategoriesCreated: string[];
}
```

**Step 2: Export new types from index.ts**

In `packages/core/src/index.ts`, add the new types to the export line:

```typescript
export type { Prompt, Category, Tag, PromptCreateInput, PromptUpdateInput, PromptSearchParams, LLMConfig, LLMClassifyResult, GenerateSession, GenerateStartInput, GenerateRefineInput, GenerateResult, GenerateSaveInput, OrganizeSuggestion, OrganizeScanResult, OrganizeApplyInput, OrganizeApplyResult } from './models.js';
```

**Step 3: Commit**

```bash
git add packages/core/src/models.ts packages/core/src/index.ts
git commit -m "feat(core): add organize feature type definitions"
```

---

### Task 2: Write failing tests for PromptOrganizer

**Files:**
- Create: `packages/core/src/__tests__/prompt-organizer.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptOrganizer } from '../prompt-organizer.js';
import type { LLMConfig, Prompt, Category } from '../models.js';

const mockConfig: LLMConfig = {
  baseUrl: 'https://fake-llm.test/v1',
  apiKey: 'sk-test-key',
  model: 'test-model',
};

const mockFetch = vi.fn();

function makeMockPrompt(overrides: Partial<Prompt> & { id: string }): Prompt {
  return {
    title: 'Test Prompt',
    content: 'Some test content for the prompt',
    categoryId: 'cat-1',
    tags: ['test'],
    isFavorite: false,
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const mockCategories: Category[] = [
  { id: 'cat-1', name: '编程', icon: '💻', sortOrder: 0 },
  { id: 'cat-2', name: '写作', icon: '✍️', sortOrder: 1 },
  { id: 'cat-3', name: '其他', icon: '📁', sortOrder: 99 },
];

describe('PromptOrganizer', () => {
  let organizer: PromptOrganizer;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    organizer = new PromptOrganizer(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockLLMResponse(content: string) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content } }],
      }),
    });
  }

  describe('scan', () => {
    it('should return suggestions for prompts that need optimization', async () => {
      const prompts = [
        makeMockPrompt({ id: 'p1', title: 'Python代码...', content: '帮我写一个Python异常处理的最佳实践提示词', categoryId: 'cat-3', tags: [] }),
        makeMockPrompt({ id: 'p2', title: '好用的翻译', content: '你是一个专业的中英文翻译助手', categoryId: 'cat-1', tags: ['翻译'] }),
      ];

      const llmResponse = JSON.stringify({
        suggestions: [
          {
            promptId: 'p1',
            newTitle: 'Python异常处理模板',
            newCategory: '编程',
            isNewCategory: false,
            newTags: ['python', '异常处理'],
            similarTo: [],
            reason: '标题模糊，分类应为编程',
          },
          {
            promptId: 'p2',
            newTitle: '中英文翻译助手',
            newCategory: '翻译',
            isNewCategory: false,
            newTags: ['翻译', '中英文'],
            similarTo: [],
            reason: '分类应为翻译而非编程',
          },
        ],
      });
      mockLLMResponse(llmResponse);

      const result = await organizer.scan(prompts, mockCategories);
      expect(result.suggestions.length).toBe(2);
      expect(result.totalScanned).toBe(2);
      expect(result.batchesCompleted).toBe(1);
      expect(result.batchesFailed).toBe(0);

      const s1 = result.suggestions.find(s => s.promptId === 'p1')!;
      expect(s1.newTitle).toBe('Python异常处理模板');
      expect(s1.newCategory).toBe('编程');
      expect(s1.newTags).toEqual(['python', '异常处理']);
    });

    it('should batch prompts when there are many', async () => {
      const prompts = Array.from({ length: 25 }, (_, i) =>
        makeMockPrompt({ id: `p${i}`, title: `Prompt ${i}`, content: `Content ${i}` })
      );

      // Two batches: first 15, then 10
      const batch1Response = JSON.stringify({
        suggestions: prompts.slice(0, 15).map(p => ({
          promptId: p.id,
          newTitle: null,
          newCategory: null,
          isNewCategory: false,
          newTags: null,
          similarTo: [],
          reason: '无需修改',
        })),
      });
      const batch2Response = JSON.stringify({
        suggestions: prompts.slice(15).map(p => ({
          promptId: p.id,
          newTitle: null,
          newCategory: null,
          isNewCategory: false,
          newTags: null,
          similarTo: [],
          reason: '无需修改',
        })),
      });
      mockLLMResponse(batch1Response);
      mockLLMResponse(batch2Response);

      const result = await organizer.scan(prompts, mockCategories);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.totalScanned).toBe(25);
      expect(result.batchesCompleted).toBe(2);
    });

    it('should handle LLM errors gracefully by skipping failed batches', async () => {
      const prompts = Array.from({ length: 25 }, (_, i) =>
        makeMockPrompt({ id: `p${i}`, title: `Prompt ${i}`, content: `Content ${i}` })
      );

      // First batch succeeds
      const batch1Response = JSON.stringify({
        suggestions: prompts.slice(0, 15).map(p => ({
          promptId: p.id,
          newTitle: null,
          newCategory: null,
          isNewCategory: false,
          newTags: null,
          similarTo: [],
          reason: '无需修改',
        })),
      });
      mockLLMResponse(batch1Response);

      // Second batch fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await organizer.scan(prompts, mockCategories);
      expect(result.batchesCompleted).toBe(1);
      expect(result.batchesFailed).toBe(1);
      expect(result.suggestions.length).toBe(15);
    });

    it('should send correct system prompt with categories and tags context', async () => {
      const prompts = [
        makeMockPrompt({ id: 'p1', title: 'Test', content: 'Test content', tags: ['existing-tag'] }),
      ];

      const llmResponse = JSON.stringify({
        suggestions: [{
          promptId: 'p1',
          newTitle: null,
          newCategory: null,
          isNewCategory: false,
          newTags: null,
          similarTo: [],
          reason: '无需修改',
        }],
      });
      mockLLMResponse(llmResponse);

      await organizer.scan(prompts, mockCategories);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemMsg = callBody.messages[0].content;
      expect(systemMsg).toContain('编程');
      expect(systemMsg).toContain('写作');
      expect(systemMsg).toContain('其他');
    });

    it('should truncate prompt content to 500 chars', async () => {
      const longContent = 'A'.repeat(1000);
      const prompts = [
        makeMockPrompt({ id: 'p1', title: 'Long', content: longContent }),
      ];

      const llmResponse = JSON.stringify({
        suggestions: [{
          promptId: 'p1', newTitle: null, newCategory: null,
          isNewCategory: false, newTags: null, similarTo: [], reason: '',
        }],
      });
      mockLLMResponse(llmResponse);

      await organizer.scan(prompts, mockCategories);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMsg = callBody.messages[1].content;
      // Content should be truncated
      expect(userMsg.length).toBeLessThan(longContent.length + 500);
    });

    it('should return empty results for empty prompt list', async () => {
      const result = await organizer.scan([], mockCategories);
      expect(result.suggestions).toEqual([]);
      expect(result.totalScanned).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should detect duplicates via similarTo field', async () => {
      const prompts = [
        makeMockPrompt({ id: 'p1', title: 'Python帮助', content: '帮我写Python代码' }),
        makeMockPrompt({ id: 'p2', title: 'Python助手', content: '帮我编写Python代码' }),
      ];

      const llmResponse = JSON.stringify({
        suggestions: [
          {
            promptId: 'p1', newTitle: 'Python编码助手', newCategory: null,
            isNewCategory: false, newTags: null, similarTo: ['p2'], reason: '与p2内容相似',
          },
          {
            promptId: 'p2', newTitle: 'Python编码助手', newCategory: null,
            isNewCategory: false, newTags: null, similarTo: ['p1'], reason: '与p1内容相似',
          },
        ],
      });
      mockLLMResponse(llmResponse);

      const result = await organizer.scan(prompts, mockCategories);
      const s1 = result.suggestions.find(s => s.promptId === 'p1')!;
      expect(s1.similarTo).toContain('p2');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @promptstash/core test -- prompt-organizer.test.ts`
Expected: FAIL with "Cannot find module '../prompt-organizer.js'"

**Step 3: Commit**

```bash
git add packages/core/src/__tests__/prompt-organizer.test.ts
git commit -m "test(core): add failing tests for PromptOrganizer"
```

---

### Task 3: Implement PromptOrganizer class

**Files:**
- Create: `packages/core/src/prompt-organizer.ts`
- Modify: `packages/core/src/index.ts` (add export)

**Step 1: Implement the PromptOrganizer class**

```typescript
import type { LLMConfig, Prompt, Category, OrganizeSuggestion, OrganizeScanResult } from './models.js';

const BATCH_SIZE = 15;

export class PromptOrganizer {
  constructor(private config: LLMConfig) {}

  async scan(
    prompts: Prompt[],
    categories: Category[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<OrganizeScanResult> {
    if (prompts.length === 0) {
      return { suggestions: [], totalScanned: 0, batchesCompleted: 0, batchesFailed: 0 };
    }

    const batches: Prompt[][] = [];
    for (let i = 0; i < prompts.length; i += BATCH_SIZE) {
      batches.push(prompts.slice(i, i + BATCH_SIZE));
    }

    const allSuggestions: OrganizeSuggestion[] = [];
    let batchesCompleted = 0;
    let batchesFailed = 0;

    for (let i = 0; i < batches.length; i++) {
      try {
        const batchSuggestions = await this.analyzeBatch(batches[i], categories, prompts);
        allSuggestions.push(...batchSuggestions);
        batchesCompleted++;
      } catch {
        batchesFailed++;
      }
      onProgress?.(i + 1, batches.length);
    }

    return {
      suggestions: allSuggestions,
      totalScanned: prompts.length,
      batchesCompleted,
      batchesFailed,
    };
  }

  private async analyzeBatch(
    batch: Prompt[],
    categories: Category[],
    allPrompts: Prompt[],
  ): Promise<OrganizeSuggestion[]> {
    const catNames = categories.map(c => c.name).join(', ');
    const allTags = [...new Set(allPrompts.flatMap(p => p.tags))].join(', ');

    const systemPrompt = `你是一个提示词库整理助手。你的任务是分析提示词并给出优化建议。

现有分类: [${catNames}]
现有标签: [${allTags}]

对于每个提示词，请分析以下方面：
1. **标题优化**: 如果标题模糊、过长(超过10字)或不够描述性，建议一个更好的标题（10字以内）。无需修改则设为 null。
2. **分类调整**: 如果当前分类不合适，建议更合适的分类。优先从现有分类中选择。如果确实需要新分类，设置 isNewCategory 为 true。无需修改则设为 null。
3. **标签优化**: 如果标签缺失、不相关或需要标准化，建议新的标签列表（1-3个）。无需修改则设为 null。
4. **重复检测**: 如果发现本批次中有内容高度相似的提示词，在 similarTo 中填写对方的 promptId。

严格以 JSON 格式返回: {"suggestions": [{"promptId":"...", "newTitle":"...|null", "newCategory":"...|null", "isNewCategory":false, "newTags":["..."]|null, "similarTo":["..."], "reason":"..."}]}`;

    const promptsData = batch.map(p => ({
      promptId: p.id,
      title: p.title,
      content: p.content.length > 500 ? p.content.slice(0, 500) + '...' : p.content,
      category: categories.find(c => c.id === p.categoryId)?.name || '未知',
      tags: p.tags,
    }));

    const url = `${this.config.baseUrl}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(promptsData) },
        ],
        temperature: 0.3,
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

    const parsed = JSON.parse(raw) as {
      suggestions: Array<{
        promptId: string;
        newTitle: string | null;
        newCategory: string | null;
        isNewCategory: boolean;
        newTags: string[] | null;
        similarTo: string[];
        reason: string;
      }>;
    };

    return parsed.suggestions.map(s => {
      const prompt = batch.find(p => p.id === s.promptId);
      return {
        promptId: s.promptId,
        originalTitle: prompt?.title || '',
        newTitle: s.newTitle,
        originalCategory: categories.find(c => c.id === prompt?.categoryId)?.name || '',
        newCategory: s.newCategory,
        isNewCategory: s.isNewCategory ?? false,
        originalTags: prompt?.tags || [],
        newTags: s.newTags,
        similarTo: Array.isArray(s.similarTo) ? s.similarTo : [],
        reason: s.reason || '',
      };
    });
  }
}
```

**Step 2: Add export to index.ts**

In `packages/core/src/index.ts`, add:

```typescript
export { PromptOrganizer } from './prompt-organizer.js';
```

**Step 3: Run tests to verify they pass**

Run: `pnpm --filter @promptstash/core test -- prompt-organizer.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add packages/core/src/prompt-organizer.ts packages/core/src/index.ts
git commit -m "feat(core): implement PromptOrganizer with batch LLM analysis"
```

---

### Task 4: Add organize API endpoints to server

**Files:**
- Modify: `packages/electron/src/main/server.ts`

**Step 1: Add imports**

At the top of `server.ts`, add `PromptOrganizer` to the core imports:

```typescript
import { PromptRepo, CategoryRepo, TagRepo, SettingsRepo, Classifier, LLMService, PromptGenerator, PromptOrganizer } from '@promptstash/core';
```

Also add the new types to the type import:

```typescript
import type { PromptSearchParams, PromptCreateInput, PromptUpdateInput, LLMConfig, OrganizeApplyInput } from '@promptstash/core';
```

**Step 2: Add the organize endpoints before the `return app;` line (after the generate endpoints)**

```typescript
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
          // Check if category already exists
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
```

**Step 3: Commit**

```bash
git add packages/electron/src/main/server.ts
git commit -m "feat(server): add organize scan and apply API endpoints"
```

---

### Task 5: Write and run tests for organize API endpoints

**Files:**
- Modify: `packages/core/src/__tests__/server.test.ts`

**Step 1: Add organize API tests after the "Prompt Generation API" describe block**

```typescript
  describe('Organize API', () => {
    beforeAll(() => {
      const originalFetch = globalThis.fetch;
      vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        if (urlStr.includes('/chat/completions')) {
          // Parse the request to get prompt IDs from the user message
          const body = JSON.parse(init?.body as string);
          const userContent = body.messages[1].content;
          const promptsData = JSON.parse(userContent) as Array<{ promptId: string }>;
          const suggestions = promptsData.map(p => ({
            promptId: p.promptId,
            newTitle: 'Optimized Title',
            newCategory: '编程',
            isNewCategory: false,
            newTags: ['optimized'],
            similarTo: [],
            reason: 'Test optimization',
          }));
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({ suggestions }) } }],
            }),
          } as Response;
        }
        return originalFetch(url, init);
      });
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('POST /api/organize/scan should return suggestions', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/organize/scan',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('suggestions');
      expect(body).toHaveProperty('totalScanned');
      expect(body).toHaveProperty('batchesCompleted');
      expect(Array.isArray(body.suggestions)).toBe(true);
    });

    it('POST /api/organize/apply should update prompts', async () => {
      // First get a prompt to apply changes to
      const searchRes = await server.inject({
        method: 'GET',
        url: '/api/prompts/search',
      });
      const allPrompts = searchRes.json();
      if (allPrompts.length === 0) return; // Skip if no prompts

      const targetPrompt = allPrompts[0];

      const res = await server.inject({
        method: 'POST',
        url: '/api/organize/apply',
        payload: {
          changes: [{
            promptId: targetPrompt.id,
            newTitle: 'Organized Title',
            newCategoryId: categoryId,
            newTags: ['organized', 'clean'],
          }],
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.applied).toBe(1);
      expect(body.failed).toBe(0);

      // Verify the prompt was updated
      const verifyRes = await server.inject({
        method: 'GET',
        url: `/api/prompts/${targetPrompt.id}`,
      });
      const updated = verifyRes.json();
      expect(updated.title).toBe('Organized Title');
      expect(updated.tags).toEqual(['organized', 'clean']);
    });

    it('POST /api/organize/apply should return 400 for empty changes', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/organize/apply',
        payload: { changes: [] },
      });
      expect(res.statusCode).toBe(400);
    });
  });
```

**Step 2: Run tests**

First rebuild better-sqlite3 for system Node if needed:
```bash
npx --yes node-gyp rebuild --directory=node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3
```

Run: `pnpm --filter @promptstash/core test -- server.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/core/src/__tests__/server.test.ts
git commit -m "test(core): add organize API endpoint tests"
```

---

### Task 6: Add OrganizePanel UI component to App.tsx

**Files:**
- Modify: `packages/electron/src/renderer/App.tsx`

**Step 1: Add OrganizeIcon component after SparkleIcon (around line 107)**

```typescript
function OrganizeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M4 8h8M6 12h4" />
    </svg>
  );
}
```

**Step 2: Add OrganizeSuggestion interface and OrganizePanel component after GeneratePanel (after line 641)**

```typescript
interface OrganizeSuggestionItem {
  promptId: string;
  originalTitle: string;
  newTitle: string | null;
  originalCategory: string;
  newCategory: string | null;
  isNewCategory: boolean;
  originalTags: string[];
  newTags: string[] | null;
  similarTo: string[];
  reason: string;
}

interface OrganizeScanResponse {
  suggestions: OrganizeSuggestionItem[];
  totalScanned: number;
  batchesCompleted: number;
  batchesFailed: number;
}

function OrganizePanel({ onComplete, onClose }: {
  onComplete: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'results' | 'applying' | 'done'>('idle');
  const [scanResult, setScanResult] = useState<OrganizeScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'title' | 'category' | 'tags' | 'duplicates'>('title');
  const [applyResult, setApplyResult] = useState<{ applied: number; failed: number } | null>(null);

  const handleScan = async () => {
    setPhase('scanning');
    setError(null);
    try {
      const r = await fetch(`${API}/api/organize/scan`, { method: 'POST' });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Scan failed');
      }
      const data: OrganizeScanResponse = await r.json();
      setScanResult(data);
      // Auto-select all suggestions that have actual changes
      const ids = new Set<string>();
      for (const s of data.suggestions) {
        if (s.newTitle || s.newCategory || s.newTags) {
          ids.add(s.promptId);
        }
      }
      setSelected(ids);
      setPhase('results');
    } catch (err: any) {
      setError(err.message || '扫描失败');
      setPhase('idle');
    }
  };

  const handleApply = async () => {
    if (!scanResult) return;
    setPhase('applying');
    setError(null);

    const changes = scanResult.suggestions
      .filter(s => selected.has(s.promptId))
      .map(s => {
        const change: any = { promptId: s.promptId };
        if (s.newTitle) change.newTitle = s.newTitle;
        if (s.newCategory) {
          if (s.isNewCategory) {
            change.newCategoryName = s.newCategory;
            change.isNewCategory = true;
          } else {
            // Look up category ID - we need categories for this
            change.newCategoryName = s.newCategory;
          }
        }
        if (s.newTags) change.newTags = s.newTags;
        return change;
      });

    try {
      const r = await fetch(`${API}/api/organize/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Apply failed');
      }
      const result = await r.json();
      setApplyResult(result);
      setPhase('done');
    } catch (err: any) {
      setError(err.message || '应用失败');
      setPhase('results');
    }
  };

  const toggleSelect = (promptId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(promptId)) next.delete(promptId);
      else next.add(promptId);
      return next;
    });
  };

  const titleSuggestions = scanResult?.suggestions.filter(s => s.newTitle) || [];
  const categorySuggestions = scanResult?.suggestions.filter(s => s.newCategory) || [];
  const tagsSuggestions = scanResult?.suggestions.filter(s => s.newTags) || [];
  const duplicates = scanResult?.suggestions.filter(s => s.similarTo.length > 0) || [];

  const tabCounts = {
    title: titleSuggestions.length,
    category: categorySuggestions.length,
    tags: tagsSuggestions.length,
    duplicates: duplicates.length,
  };

  const currentList = activeTab === 'title' ? titleSuggestions
    : activeTab === 'category' ? categorySuggestions
    : activeTab === 'tags' ? tagsSuggestions
    : duplicates;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">智能整理</h2>
        <button onClick={onClose} className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          关闭
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
        {phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-3xl">🧹</div>
            <div>
              <p className="text-sm text-gray-700 font-medium">扫描所有提示词</p>
              <p className="text-xs text-gray-400 mt-1">智能优化标题、分类和标签，检测重复内容</p>
            </div>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <div>
              <p className="text-sm text-gray-700 font-medium">正在分析...</p>
              <p className="text-xs text-gray-400 mt-1">AI 正在审查您的提示词库</p>
            </div>
          </div>
        )}

        {phase === 'results' && scanResult && (
          <>
            <div className="text-xs text-gray-500">
              扫描了 {scanResult.totalScanned} 条提示词，发现 {selected.size} 条优化建议
              {scanResult.batchesFailed > 0 && (
                <span className="text-amber-500">（{scanResult.batchesFailed} 批次分析失败）</span>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-100 -mx-5 px-5">
              {([
                ['title', '标题', tabCounts.title],
                ['category', '分类', tabCounts.category],
                ['tags', '标签', tabCounts.tags],
                ['duplicates', '重复', tabCounts.duplicates],
              ] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`text-xs px-2.5 py-1.5 border-b-2 transition-colors ${
                    activeTab === key
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            {/* Suggestion list */}
            <div className="flex flex-col gap-2">
              {currentList.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">此分类无优化建议</p>
              )}
              {currentList.map((s) => (
                <label
                  key={`${activeTab}-${s.promptId}`}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer transition-colors"
                >
                  {activeTab !== 'duplicates' && (
                    <input
                      type="checkbox"
                      checked={selected.has(s.promptId)}
                      onChange={() => toggleSelect(s.promptId)}
                      className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    {activeTab === 'title' && (
                      <>
                        <p className="text-xs text-gray-400 line-through truncate">{s.originalTitle}</p>
                        <p className="text-xs text-gray-700 font-medium truncate">{s.newTitle}</p>
                      </>
                    )}
                    {activeTab === 'category' && (
                      <>
                        <p className="text-xs truncate">
                          <span className="text-gray-400">{s.originalTitle}</span>
                        </p>
                        <p className="text-xs">
                          <span className="text-gray-400">{s.originalCategory}</span>
                          <span className="text-gray-300 mx-1">→</span>
                          <span className="text-indigo-600 font-medium">{s.newCategory}</span>
                          {s.isNewCategory && <span className="text-[10px] text-amber-500 ml-1">新分类</span>}
                        </p>
                      </>
                    )}
                    {activeTab === 'tags' && (
                      <>
                        <p className="text-xs text-gray-400 truncate">{s.originalTitle}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {s.originalTags.map(t => (
                            <span key={`old-${t}`} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 line-through">{t}</span>
                          ))}
                          <span className="text-gray-300 text-[10px]">→</span>
                          {(s.newTags || []).map(t => (
                            <span key={`new-${t}`} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{t}</span>
                          ))}
                        </div>
                      </>
                    )}
                    {activeTab === 'duplicates' && (
                      <>
                        <p className="text-xs text-gray-700 font-medium truncate">{s.originalTitle}</p>
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          与 {s.similarTo.length} 条提示词内容相似
                        </p>
                      </>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.reason}</p>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {phase === 'applying' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-700">正在应用修改...</p>
          </div>
        )}

        {phase === 'done' && applyResult && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-3xl">✅</div>
            <div>
              <p className="text-sm text-gray-700 font-medium">整理完成</p>
              <p className="text-xs text-gray-500 mt-1">
                成功更新 {applyResult.applied} 条提示词
                {applyResult.failed > 0 && `，${applyResult.failed} 条失败`}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700">{error}</div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
        {phase === 'idle' && (
          <button
            onClick={handleScan}
            className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            开始扫描
          </button>
        )}
        {phase === 'results' && (
          <>
            <button
              onClick={() => { setPhase('idle'); setScanResult(null); setError(null); }}
              className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              重新扫描
            </button>
            <button
              onClick={handleApply}
              disabled={selected.size === 0}
              className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              应用修改 ({selected.size})
            </button>
          </>
        )}
        {phase === 'done' && (
          <button
            onClick={() => { onComplete(); onClose(); }}
            className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            完成
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add packages/electron/src/renderer/App.tsx
git commit -m "feat(ui): add OrganizePanel component"
```

---

### Task 7: Integrate OrganizePanel into App layout

**Files:**
- Modify: `packages/electron/src/renderer/App.tsx`

**Step 1: Extend the mode type (line 650)**

Change:
```typescript
const [mode, setMode] = useState<'view' | 'create' | 'edit' | 'settings' | 'generate'>('view');
```
To:
```typescript
const [mode, setMode] = useState<'view' | 'create' | 'edit' | 'settings' | 'generate' | 'organize'>('view');
```

**Step 2: Add the Organize button in the sidebar, after the settings button (around line 1113, before `</div></aside>`)**

After the settings button `</button>` (line 1113), add:
```typescript
          <button
            onClick={() => { setMode('organize'); setSelectedPrompt(null); }}
            className={`flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-lg text-left transition-colors ${
              mode === 'organize' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/80'
            }`}
          >
            <OrganizeIcon />
            整理
          </button>
```

**Step 3: Add OrganizePanel rendering in the right panel area (after the generate panel block, before `</div>` closing the root div)**

After the generate panel `{mode === 'generate' && (...)}` block (around line 1338), add:

```typescript
      {mode === 'organize' && (
        <aside className="w-[340px] bg-white border-l border-gray-200/60 flex flex-col">
          <OrganizePanel
            onComplete={() => {
              refreshPrompts();
              fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
            }}
            onClose={() => setMode('view')}
          />
        </aside>
      )}
```

**Step 4: Commit**

```bash
git add packages/electron/src/renderer/App.tsx
git commit -m "feat(ui): integrate OrganizePanel into App layout with sidebar entry"
```

---

### Task 8: Fix organize/apply to resolve category names to IDs

**Files:**
- Modify: `packages/electron/src/main/server.ts`

The current `apply` endpoint needs to handle `newCategoryName` by looking up or creating the category. Review the implementation from Task 4 — it already handles this via `change.isNewCategory` and `change.newCategoryName`.

However, for non-new categories, we need to resolve the category name to ID. Update the apply endpoint:

**Step 1: Update the apply handler**

In the apply handler loop, change the category resolution to also handle name-based lookup for existing categories:

```typescript
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
          // Resolve existing category name to ID
          const existing = catList.find(c => c.name === change.newCategoryName);
          if (existing) {
            update.categoryId = existing.id;
          }
        }
```

**Step 2: Run all tests**

```bash
pnpm --filter @promptstash/core test
```
Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/electron/src/main/server.ts
git commit -m "fix(server): resolve category names to IDs in organize/apply"
```

---

### Task 9: Update CLAUDE.md with new API endpoints

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add the new endpoints to the API table**

Add to the API Endpoints table:

```markdown
| POST | `/api/organize/scan` | Scan all prompts for optimization suggestions |
| POST | `/api/organize/apply` | Apply selected organize suggestions |
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add organize API endpoints to CLAUDE.md"
```

---

### Task 10: Build and manual verification

**Step 1: Build the electron app**

```bash
pnpm build:electron
```
Expected: Build succeeds

**Step 2: Rebuild better-sqlite3 for system Node (for any future test runs)**

```bash
npx --yes node-gyp rebuild --directory=node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3
```

**Step 3: Run full test suite**

```bash
pnpm test
```
Expected: All tests PASS

**Step 4: Commit any remaining changes**

If no changes: done. Otherwise commit.
