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
