import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../db.js';
import type { Category } from '../models.js';

interface CreateCategoryInput {
  name: string;
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
