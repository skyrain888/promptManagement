import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptGenerator } from '../prompt-generator.js';
import type { LLMConfig } from '../models.js';

const mockConfig: LLMConfig = {
  baseUrl: 'https://fake-llm.test/v1',
  apiKey: 'sk-test-key',
  model: 'test-model',
};

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
      const startJson = JSON.stringify({ prompt: 'initial prompt', title: '初始' });
      mockLLMResponse(startJson);
      const { sessionId } = await generator.startSession('需求');
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
      const secondCallArgs = JSON.parse(mockFetch.mock.calls[1][1].body);
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
      const session = generator.getSession(sessionId)!;
      session.updatedAt = Date.now() - 31 * 60 * 1000;
      generator.cleanupExpired();
      expect(generator.getSession(sessionId)).toBeUndefined();
    });
  });
});
