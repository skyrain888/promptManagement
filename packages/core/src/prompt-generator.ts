import { randomUUID } from 'node:crypto';
import type { LLMConfig, GenerateSession, GenerateResult } from './models.js';

const SESSION_EXPIRY_MS = 30 * 60 * 1000;

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
      messages: [...messages, { role: 'assistant', content: JSON.stringify({ prompt, title }) }],
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
    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('LLM returned empty response');
    const parsed = JSON.parse(raw) as { prompt: string; title: string };
    if (!parsed.prompt) throw new Error('LLM response missing prompt field');
    return { prompt: parsed.prompt, title: parsed.title || '未命名提示词' };
  }
}
