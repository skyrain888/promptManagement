export interface Prompt {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  tags: string[];
  source?: string;
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  sortOrder: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface PromptCreateInput {
  title: string;
  content: string;
  categoryId: string;
  tags?: string[];
  source?: string;
}

export interface PromptUpdateInput {
  title?: string;
  content?: string;
  categoryId?: string;
  tags?: string[];
  source?: string;
}

export interface PromptSearchParams {
  q?: string;
  categoryId?: string;
  tag?: string;
  favorite?: boolean;
  limit?: number;
  offset?: number;
}

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LLMClassifyResult {
  title: string;
  category: string;
  isNewCategory: boolean;
  tags: string[];
}
