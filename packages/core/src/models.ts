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

export interface GenerateSession {
  id: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  generatedPrompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface GenerateStartInput {
  requirement: string;
}

export interface GenerateRefineInput {
  sessionId: string;
  feedback: string;
}

export interface GenerateResult {
  sessionId: string;
  prompt: string;
  title: string;
}

export interface GenerateSaveInput {
  sessionId: string;
}

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
