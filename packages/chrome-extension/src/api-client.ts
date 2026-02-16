const BASE_URL = 'http://127.0.0.1:9877';

export interface ClassifyResponse {
  title: string;
  category: string;
  categoryId: string;
  tags: string[];
  isNewCategory: boolean;
}

export const api = {
  async searchPrompts(q: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/api/prompts/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
  },

  async createPrompt(data: {
    title: string;
    content: string;
    categoryId: string;
    tags?: string[];
    source?: string;
  }): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    return res.json();
  },

  async classify(content: string): Promise<ClassifyResponse> {
    const res = await fetch(`${BASE_URL}/api/prompts/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`Classify failed: ${res.status}`);
    return res.json();
  },

  async getCategories(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/api/categories`);
    if (!res.ok) throw new Error(`Categories failed: ${res.status}`);
    return res.json();
  },

  async recordUsage(id: string): Promise<void> {
    await fetch(`${BASE_URL}/api/prompts/${id}/use`, { method: 'POST' });
  },
};
