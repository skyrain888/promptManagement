import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../db.js';
import type { Category } from '../models.js';

interface CreateCategoryInput {
  name: string;
  icon?: string;
  sortOrder?: number;
}

interface UpdateCategoryInput {
  name?: string;
  icon?: string;
  sortOrder?: number;
}

export class CategoryRepo {
  constructor(private db: Database) {}

  create(input: CreateCategoryInput): Category {
    const id = uuidv4();
    const sortOrder = input.sortOrder ?? 0;
    this.db.raw
      .prepare('INSERT INTO categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)')
      .run(id, input.name, input.icon ?? null, sortOrder);
    return { id, name: input.name, icon: input.icon, sortOrder };
  }

  getById(id: string): Category | undefined {
    const row = this.db.raw
      .prepare('SELECT id, name, icon, sort_order as sortOrder FROM categories WHERE id = ?')
      .get(id) as Category | undefined;
    return row;
  }

  listAll(): Category[] {
    return this.db.raw
      .prepare('SELECT id, name, icon, sort_order as sortOrder FROM categories ORDER BY sort_order ASC')
      .all() as Category[];
  }

  update(id: string, input: UpdateCategoryInput): Category | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const name = input.name ?? existing.name;
    const icon = input.icon !== undefined ? input.icon : existing.icon;
    const sortOrder = input.sortOrder ?? existing.sortOrder;
    this.db.raw
      .prepare('UPDATE categories SET name = ?, icon = ?, sort_order = ? WHERE id = ?')
      .run(name, icon ?? null, sortOrder, id);
    return { id, name, icon: icon ?? undefined, sortOrder };
  }

  delete(id: string): boolean {
    // Find the "其他" category to reassign prompts
    const otherCat = this.db.raw
      .prepare("SELECT id FROM categories WHERE name = '其他'")
      .get() as { id: string } | undefined;

    if (otherCat && otherCat.id === id) {
      // Cannot delete the "其他" fallback category
      return false;
    }

    const tx = this.db.raw.transaction(() => {
      if (otherCat) {
        // Reassign prompts from this category to "其他"
        this.db.raw
          .prepare('UPDATE prompts SET category_id = ? WHERE category_id = ?')
          .run(otherCat.id, id);
      }
      this.db.raw.prepare('DELETE FROM categories WHERE id = ?').run(id);
    });
    tx();
    return true;
  }

  seedDefaults(): void {
    const defaults: CreateCategoryInput[] = [
      { name: '编程', icon: '💻', sortOrder: 0 },
      { name: '写作', icon: '✍️', sortOrder: 1 },
      { name: '翻译', icon: '🌐', sortOrder: 2 },
      { name: '分析', icon: '📊', sortOrder: 3 },
      { name: '创意', icon: '💡', sortOrder: 4 },
      { name: '其他', icon: '📁', sortOrder: 99 },
    ];
    const insert = this.db.raw.prepare(
      'INSERT OR IGNORE INTO categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)'
    );
    const tx = this.db.raw.transaction(() => {
      for (const d of defaults) {
        insert.run(uuidv4(), d.name, d.icon ?? null, d.sortOrder ?? 0);
      }
    });
    tx();
  }
}
