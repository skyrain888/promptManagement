import type { LLMConfig, LLMClassifyResult } from './models.js';

export class LLMService {
  constructor(private config: LLMConfig) {}

  async classifyAndTitle(content: string, existingCategories: string[]): Promise<LLMClassifyResult> {
    const categoriesList = existingCategories.join(', ');
    const truncated = content.length > 2000 ? content.slice(0, 2000) + '...' : content;

    const systemPrompt = `你是一个提示词分类助手。根据用户提供的内容：
1. 生成一个简洁的中文标题（10字以内）
2. 从现有分类中选择最合适的一个: [${categoriesList}]
   如果现有分类都不合适，建议一个新的分类名称（2-4个字），并将 isNewCategory 设为 true
3. 提取 1-3 个相关标签

严格以 JSON 格式返回，不要包含其他内容: {"title":"...","category":"...","isNewCategory":false,"tags":["..."]}`;

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
          { role: 'user', content: truncated },
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
    if (!raw) {
      throw new Error('LLM returned empty response');
    }

    const parsed = JSON.parse(raw) as LLMClassifyResult;

    // Validate required fields
    if (!parsed.title || !parsed.category) {
      throw new Error('LLM response missing required fields');
    }

    return {
      title: parsed.title,
      category: parsed.category,
      isNewCategory: parsed.isNewCategory ?? false,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  }
}
