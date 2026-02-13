import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../db.js';
import type { Prompt, PromptCreateInput, PromptSearchParams } from '../models.js';

interface PromptRow {
  id: string;
  title: string;
  content: string;
  category_id: string;
  source: string | null;
  is_favorite: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export class PromptRepo {
  constructor(private db: Database) {}

  create(input: PromptCreateInput): Prompt {
    const id = uuidv4();
    const now = new Date().toISOString();
    const tags = input.tags ?? [];

    const tx = this.db.raw.transaction(() => {
      this.db.raw
        .prepare(
          `INSERT INTO prompts (id, title, content, category_id, source, is_favorite, usage_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`
        )
        .run(id, input.title, input.content, input.categoryId, input.source ?? null, now, now);

      const insertTag = this.db.raw.prepare(
        'INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)'
      );
      const findTag = this.db.raw.prepare('SELECT id FROM tags WHERE name = ?');
      const linkTag = this.db.raw.prepare(
        'INSERT INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)'
      );

      for (const tagName of tags) {
        let tagRow = findTag.get(tagName) as { id: string } | undefined;
        if (!tagRow) {
          const tagId = uuidv4();
          insertTag.run(tagId, tagName);
          tagRow = { id: tagId };
        }
        linkTag.run(id, tagRow.id);
      }
    });
    tx();

    return {
      id,
      title: input.title,
      content: input.content,
      categoryId: input.categoryId,
      tags,
      source: input.source,
      isFavorite: false,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  getById(id: string): Prompt | undefined {
    const row = this.db.raw
      .prepare('SELECT * FROM prompts WHERE id = ?')
      .get(id) as PromptRow | undefined;
    if (!row) return undefined;
    return this.toPrompt(row);
  }

  search(params: PromptSearchParams): Prompt[] {
    let sql: string;
    const args: unknown[] = [];

    if (params.q) {
      sql = `SELECT p.* FROM prompts p
             INNER JOIN prompts_fts fts ON p.rowid = fts.rowid
             WHERE prompts_fts MATCH ?`;
      args.push(params.q);
    } else {
      sql = 'SELECT p.* FROM prompts p WHERE 1=1';
    }

    if (params.categoryId) {
      sql += ' AND p.category_id = ?';
      args.push(params.categoryId);
    }

    if (params.tag) {
      sql += ` AND p.id IN (
        SELECT pt.prompt_id FROM prompt_tags pt
        INNER JOIN tags t ON pt.tag_id = t.id
        WHERE t.name = ?
      )`;
      args.push(params.tag);
    }

    sql += ' ORDER BY p.usage_count DESC, p.updated_at DESC';

    if (params.limit) {
      sql += ' LIMIT ?';
      args.push(params.limit);
    }
    if (params.offset) {
      sql += ' OFFSET ?';
      args.push(params.offset);
    }

    const rows = this.db.raw.prepare(sql).all(...args) as PromptRow[];
    return rows.map((r) => this.toPrompt(r));
  }

  incrementUsage(id: string): void {
    this.db.raw
      .prepare("UPDATE prompts SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?")
      .run(id);
  }

  toggleFavorite(id: string): void {
    this.db.raw
      .prepare("UPDATE prompts SET is_favorite = CASE WHEN is_favorite = 0 THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE id = ?")
      .run(id);
  }

  delete(id: string): void {
    this.db.raw.prepare('DELETE FROM prompts WHERE id = ?').run(id);
  }

  private toPrompt(row: PromptRow): Prompt {
    const tagRows = this.db.raw
      .prepare(
        'SELECT t.name FROM tags t INNER JOIN prompt_tags pt ON t.id = pt.tag_id WHERE pt.prompt_id = ?'
      )
      .all(row.id) as { name: string }[];

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      categoryId: row.category_id,
      tags: tagRows.map((t) => t.name),
      source: row.source ?? undefined,
      isFavorite: row.is_favorite === 1,
      usageCount: row.usage_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
