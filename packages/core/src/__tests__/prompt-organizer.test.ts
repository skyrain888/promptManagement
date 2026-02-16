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
            promptId: 'p1', newTitle: 'Python异常处理模板', newCategory: '编程',
            isNewCategory: false, newTags: ['python', '异常处理'], similarTo: [],
            reason: '标题模糊，分类应为编程',
          },
          {
            promptId: 'p2', newTitle: '中英文翻译助手', newCategory: '翻译',
            isNewCategory: false, newTags: ['翻译', '中英文'], similarTo: [],
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

      const batch1Response = JSON.stringify({
        suggestions: prompts.slice(0, 15).map(p => ({
          promptId: p.id, newTitle: null, newCategory: null,
          isNewCategory: false, newTags: null, similarTo: [], reason: '无需修改',
        })),
      });
      const batch2Response = JSON.stringify({
        suggestions: prompts.slice(15).map(p => ({
          promptId: p.id, newTitle: null, newCategory: null,
          isNewCategory: false, newTags: null, similarTo: [], reason: '无需修改',
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

      const batch1Response = JSON.stringify({
        suggestions: prompts.slice(0, 15).map(p => ({
          promptId: p.id, newTitle: null, newCategory: null,
          isNewCategory: false, newTags: null, similarTo: [], reason: '无需修改',
        })),
      });
      mockLLMResponse(batch1Response);
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 500, text: async () => 'Internal Server Error',
      });

      const result = await organizer.scan(prompts, mockCategories);
      expect(result.batchesCompleted).toBe(1);
      expect(result.batchesFailed).toBe(1);
      expect(result.suggestions.length).toBe(15);
    });

    it('should send correct system prompt with categories context', async () => {
      const prompts = [
        makeMockPrompt({ id: 'p1', title: 'Test', content: 'Test content', tags: ['existing-tag'] }),
      ];

      const llmResponse = JSON.stringify({
        suggestions: [{
          promptId: 'p1', newTitle: null, newCategory: null,
          isNewCategory: false, newTags: null, similarTo: [], reason: '无需修改',
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
      const prompts = [makeMockPrompt({ id: 'p1', title: 'Long', content: longContent })];

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
          { promptId: 'p1', newTitle: 'Python编码助手', newCategory: null,
            isNewCategory: false, newTags: null, similarTo: ['p2'], reason: '与p2内容相似' },
          { promptId: 'p2', newTitle: 'Python编码助手', newCategory: null,
            isNewCategory: false, newTags: null, similarTo: ['p1'], reason: '与p1内容相似' },
        ],
      });
      mockLLMResponse(llmResponse);

      const result = await organizer.scan(prompts, mockCategories);
      const s1 = result.suggestions.find(s => s.promptId === 'p1')!;
      expect(s1.similarTo).toContain('p2');
    });
  });
});
