import type { Database } from '../db.js';
import type { LLMConfig } from '../models.js';

const LLM_DEFAULTS: LLMConfig = {
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: 'sk-903b132fac034b8398ab3c9e17939ab2',
  model: 'qwen-plus-latest',
};

export class SettingsRepo {
  constructor(private db: Database) {}

  get(key: string): string | undefined {
    const row = this.db.raw
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value;
  }

  set(key: string, value: string): void {
    this.db.raw
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }

  delete(key: string): void {
    this.db.raw.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  getAll(): Record<string, string> {
    const rows = this.db.raw
      .prepare('SELECT key, value FROM settings')
      .all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  getLLMConfig(): LLMConfig {
    return {
      baseUrl: this.get('llm.baseUrl') ?? LLM_DEFAULTS.baseUrl,
      apiKey: this.get('llm.apiKey') ?? LLM_DEFAULTS.apiKey,
      model: this.get('llm.model') ?? LLM_DEFAULTS.model,
    };
  }

  setLLMConfig(config: Partial<LLMConfig>): void {
    if (config.baseUrl !== undefined) this.set('llm.baseUrl', config.baseUrl);
    if (config.apiKey !== undefined) this.set('llm.apiKey', config.apiKey);
    if (config.model !== undefined) this.set('llm.model', config.model);
  }
}
