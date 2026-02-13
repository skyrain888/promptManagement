import type { Database } from './db.js';

interface ExportData {
  version: 1;
  exportedAt: string;
  categories: { id: string; name: string; icon: string | null; sortOrder: number }[];
  tags: { id: string; name: string; color: string | null }[];
  prompts: {
    id: string;
    title: string;
    content: string;
    categoryId: string;
    source: string | null;
    isFavorite: boolean;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
    tags: string[];
  }[];
}

export function exportAll(db: Database): ExportData {
  const categories = db.raw
    .prepare('SELECT id, name, icon, sort_order as sortOrder FROM categories')
    .all() as ExportData['categories'];

  const tags = db.raw.prepare('SELECT id, name, color FROM tags').all() as ExportData['tags'];

  const promptRows = db.raw.prepare('SELECT * FROM prompts').all() as any[];
  const prompts = promptRows.map((row) => {
    const promptTags = db.raw
      .prepare('SELECT t.name FROM tags t INNER JOIN prompt_tags pt ON t.id = pt.tag_id WHERE pt.prompt_id = ?')
      .all(row.id) as { name: string }[];

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      categoryId: row.category_id,
      source: row.source,
      isFavorite: row.is_favorite === 1,
      usageCount: row.usage_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tags: promptTags.map((t) => t.name),
    };
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    tags,
    prompts,
  };
}

export function importAll(db: Database, data: ExportData): void {
  const tx = db.raw.transaction(() => {
    // Import categories
    const insertCat = db.raw.prepare(
      'INSERT OR REPLACE INTO categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)'
    );
    for (const c of data.categories) {
      insertCat.run(c.id, c.name, c.icon, c.sortOrder);
    }

    // Import tags
    const insertTag = db.raw.prepare(
      'INSERT OR REPLACE INTO tags (id, name, color) VALUES (?, ?, ?)'
    );
    for (const t of data.tags) {
      insertTag.run(t.id, t.name, t.color);
    }

    // Import prompts
    const insertPrompt = db.raw.prepare(
      `INSERT OR REPLACE INTO prompts (id, title, content, category_id, source, is_favorite, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const findTag = db.raw.prepare('SELECT id FROM tags WHERE name = ?');
    const insertPromptTag = db.raw.prepare(
      'INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)'
    );

    for (const p of data.prompts) {
      insertPrompt.run(
        p.id, p.title, p.content, p.categoryId, p.source,
        p.isFavorite ? 1 : 0, p.usageCount, p.createdAt, p.updatedAt
      );
      for (const tagName of p.tags) {
        const tagRow = findTag.get(tagName) as { id: string } | undefined;
        if (tagRow) {
          insertPromptTag.run(p.id, tagRow.id);
        }
      }
    }
  });
  tx();
}
