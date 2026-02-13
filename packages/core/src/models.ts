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

export interface PromptSearchParams {
  q?: string;
  categoryId?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}
