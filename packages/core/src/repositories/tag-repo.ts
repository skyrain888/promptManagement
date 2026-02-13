import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../db.js';
import type { Tag } from '../models.js';

interface CreateTagInput {
  name: string;
  color?: string;
}

export class TagRepo {
  constructor(private db: Database) {}

  create(input: CreateTagInput): Tag {
    const id = uuidv4();
    this.db.raw
      .prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)')
      .run(id, input.name, input.color ?? null);
    return { id, name: input.name, color: input.color };
  }

  getById(id: string): Tag | undefined {
    return this.db.raw
      .prepare('SELECT id, name, color FROM tags WHERE id = ?')
      .get(id) as Tag | undefined;
  }

  findOrCreate(name: string): Tag {
    const existing = this.db.raw
      .prepare('SELECT id, name, color FROM tags WHERE name = ?')
      .get(name) as Tag | undefined;
    if (existing) return existing;
    return this.create({ name });
  }

  listAll(): Tag[] {
    return this.db.raw
      .prepare('SELECT id, name, color FROM tags ORDER BY name ASC')
      .all() as Tag[];
  }
}
