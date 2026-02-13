# PromptStash Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-platform prompt management tool with Electron desktop app, Chrome extension, and Alfred Workflow, sharing a local SQLite database.

**Architecture:** Electron app as central hub with SQLite storage, local HTTP server (Fastify on port 9877), system tray, global shortcuts, and floating search window. Chrome extension and Alfred Workflow are lightweight clients that communicate via the local HTTP API. Monorepo managed by pnpm workspaces with shared `core` package.

**Tech Stack:** Electron + React + Tailwind CSS, better-sqlite3, Fastify, Chrome Extension Manifest V3, Vite, SQLite FTS5, pnpm workspaces

---

## Phase 1: Monorepo Scaffold & Core Package

### Task 1: Initialize monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.npmrc`

**Step 1: Initialize git repo**

Run: `git init`

**Step 2: Create root package.json**

```json
{
  "name": "promptstash",
  "private": true,
  "scripts": {
    "dev:electron": "pnpm --filter @promptstash/electron dev",
    "build:electron": "pnpm --filter @promptstash/electron build",
    "build:extension": "pnpm --filter @promptstash/chrome-extension build",
    "test": "pnpm -r test",
    "test:core": "pnpm --filter @promptstash/core test"
  },
  "engines": {
    "node": ">=20"
  }
}
```

**Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

**Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
*.db
*.db-wal
*.db-shm
.DS_Store
.env
```

**Step 6: Create .npmrc**

```
shamefully-hoist=true
```

**Step 7: Run pnpm install**

Run: `pnpm install`
Expected: Lock file created, no errors

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo scaffold"
```

---

### Task 2: Create core package — data models and types

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/models.ts`

**Step 1: Create packages/core/package.json**

```json
{
  "name": "@promptstash/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Create packages/core/src/models.ts**

```typescript
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
```

**Step 4: Install dependencies**

Run: `cd /Users/sky/Documents/dev/project/specTest/promptManagement && pnpm install`

**Step 5: Commit**

```bash
git add packages/core/package.json packages/core/tsconfig.json packages/core/src/models.ts pnpm-lock.yaml
git commit -m "feat(core): add data models and types"
```

---

### Task 3: Core package — SQLite database layer

**Files:**
- Create: `packages/core/src/db.ts`
- Create: `packages/core/src/__tests__/db.test.ts`

**Step 1: Write the failing test for DB initialization**

Create `packages/core/src/__tests__/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('Database', () => {
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) fs.rmdirSync(dir);
  });

  it('should create tables on initialization', () => {
    const tables = db.listTables();
    expect(tables).toContain('prompts');
    expect(tables).toContain('categories');
    expect(tables).toContain('tags');
    expect(tables).toContain('prompt_tags');
  });

  it('should enable WAL mode', () => {
    const mode = db.getJournalMode();
    expect(mode).toBe('wal');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @promptstash/core test`
Expected: FAIL — `Database` not found

**Step 3: Write the Database class**

Create `packages/core/src/db.ts`:

```typescript
import BetterSqlite3 from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        icon TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category_id TEXT NOT NULL,
        source TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS prompt_tags (
        prompt_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (prompt_id, tag_id),
        FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
    `);

    // FTS5 virtual table for full-text search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
        title,
        content,
        content='prompts',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS prompts_ai AFTER INSERT ON prompts BEGIN
        INSERT INTO prompts_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS prompts_ad AFTER DELETE ON prompts BEGIN
        INSERT INTO prompts_fts(prompts_fts, rowid, title, content)
        VALUES ('delete', old.rowid, old.title, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS prompts_au AFTER UPDATE ON prompts BEGIN
        INSERT INTO prompts_fts(prompts_fts, rowid, title, content)
        VALUES ('delete', old.rowid, old.title, old.content);
        INSERT INTO prompts_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
      END;
    `);
  }

  get raw(): BetterSqlite3.Database {
    return this.db;
  }

  listTables(): string[] {
    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  getJournalMode(): string {
    const row = this.db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    return row.journal_mode;
  }

  close(): void {
    this.db.close();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @promptstash/core test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/db.ts packages/core/src/__tests__/db.test.ts
git commit -m "feat(core): add SQLite database layer with WAL and FTS5"
```

---

### Task 4: Core package — Category repository

**Files:**
- Create: `packages/core/src/repositories/category-repo.ts`
- Create: `packages/core/src/__tests__/category-repo.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/category-repo.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { CategoryRepo } from '../repositories/category-repo.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('CategoryRepo', () => {
  let db: Database;
  let repo: CategoryRepo;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
    repo = new CategoryRepo(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('should create and retrieve a category', () => {
    const cat = repo.create({ name: '编程', icon: '💻', sortOrder: 0 });
    expect(cat.name).toBe('编程');
    expect(cat.id).toBeTruthy();

    const found = repo.getById(cat.id);
    expect(found).toEqual(cat);
  });

  it('should list all categories ordered by sortOrder', () => {
    repo.create({ name: '写作', sortOrder: 2 });
    repo.create({ name: '编程', sortOrder: 0 });
    repo.create({ name: '翻译', sortOrder: 1 });

    const all = repo.listAll();
    expect(all.map((c) => c.name)).toEqual(['编程', '翻译', '写作']);
  });

  it('should seed default categories', () => {
    repo.seedDefaults();
    const all = repo.listAll();
    expect(all.length).toBeGreaterThanOrEqual(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @promptstash/core test`
Expected: FAIL — `CategoryRepo` not found

**Step 3: Implement CategoryRepo**

Create `packages/core/src/repositories/category-repo.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @promptstash/core test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/repositories/category-repo.ts packages/core/src/__tests__/category-repo.test.ts
git commit -m "feat(core): add category repository with seed defaults"
```

---

### Task 5: Core package — Tag repository

**Files:**
- Create: `packages/core/src/repositories/tag-repo.ts`
- Create: `packages/core/src/__tests__/tag-repo.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/tag-repo.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { TagRepo } from '../repositories/tag-repo.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('TagRepo', () => {
  let db: Database;
  let repo: TagRepo;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
    repo = new TagRepo(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('should create and retrieve a tag', () => {
    const tag = repo.create({ name: 'python', color: '#3776AB' });
    expect(tag.name).toBe('python');
    const found = repo.getById(tag.id);
    expect(found).toEqual(tag);
  });

  it('should find or create a tag by name', () => {
    const tag1 = repo.findOrCreate('javascript');
    const tag2 = repo.findOrCreate('javascript');
    expect(tag1.id).toBe(tag2.id);
  });

  it('should list all tags', () => {
    repo.create({ name: 'python' });
    repo.create({ name: 'debug' });
    const all = repo.listAll();
    expect(all).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @promptstash/core test`
Expected: FAIL

**Step 3: Implement TagRepo**

Create `packages/core/src/repositories/tag-repo.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @promptstash/core test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/repositories/tag-repo.ts packages/core/src/__tests__/tag-repo.test.ts
git commit -m "feat(core): add tag repository with findOrCreate"
```

---

### Task 6: Core package — Prompt repository (CRUD + search)

**Files:**
- Create: `packages/core/src/repositories/prompt-repo.ts`
- Create: `packages/core/src/__tests__/prompt-repo.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/prompt-repo.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { PromptRepo } from '../repositories/prompt-repo.js';
import { CategoryRepo } from '../repositories/category-repo.js';
import { TagRepo } from '../repositories/tag-repo.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('PromptRepo', () => {
  let db: Database;
  let prompts: PromptRepo;
  let categories: CategoryRepo;
  let tags: TagRepo;
  let dbPath: string;
  let categoryId: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
    prompts = new PromptRepo(db);
    categories = new CategoryRepo(db);
    tags = new TagRepo(db);
    const cat = categories.create({ name: '编程', sortOrder: 0 });
    categoryId = cat.id;
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('should create a prompt with tags', () => {
    const prompt = prompts.create({
      title: 'Debug Python',
      content: 'Help me debug this Python code...',
      categoryId,
      tags: ['python', 'debug'],
      source: 'chatgpt.com',
    });
    expect(prompt.id).toBeTruthy();
    expect(prompt.tags).toEqual(['python', 'debug']);
    expect(prompt.usageCount).toBe(0);
  });

  it('should get a prompt by id with tags', () => {
    const created = prompts.create({
      title: 'Test Prompt',
      content: 'Content here',
      categoryId,
      tags: ['test'],
    });
    const found = prompts.getById(created.id);
    expect(found).toBeTruthy();
    expect(found!.title).toBe('Test Prompt');
    expect(found!.tags).toEqual(['test']);
  });

  it('should full-text search prompts', () => {
    prompts.create({ title: 'Python debugging', content: 'Fix errors in Python', categoryId });
    prompts.create({ title: 'React components', content: 'Build UI with React', categoryId });

    const results = prompts.search({ q: 'Python' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Python debugging');
  });

  it('should filter by category', () => {
    const cat2 = categories.create({ name: '写作', sortOrder: 1 });
    prompts.create({ title: 'Prompt A', content: 'Content A', categoryId });
    prompts.create({ title: 'Prompt B', content: 'Content B', categoryId: cat2.id });

    const results = prompts.search({ categoryId });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Prompt A');
  });

  it('should increment usage count', () => {
    const p = prompts.create({ title: 'Test', content: 'Content', categoryId });
    prompts.incrementUsage(p.id);
    prompts.incrementUsage(p.id);
    const updated = prompts.getById(p.id);
    expect(updated!.usageCount).toBe(2);
  });

  it('should toggle favorite', () => {
    const p = prompts.create({ title: 'Test', content: 'Content', categoryId });
    expect(p.isFavorite).toBe(false);
    prompts.toggleFavorite(p.id);
    expect(prompts.getById(p.id)!.isFavorite).toBe(true);
    prompts.toggleFavorite(p.id);
    expect(prompts.getById(p.id)!.isFavorite).toBe(false);
  });

  it('should delete a prompt', () => {
    const p = prompts.create({ title: 'Test', content: 'Content', categoryId });
    prompts.delete(p.id);
    expect(prompts.getById(p.id)).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @promptstash/core test`
Expected: FAIL

**Step 3: Implement PromptRepo**

Create `packages/core/src/repositories/prompt-repo.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @promptstash/core test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/repositories/prompt-repo.ts packages/core/src/__tests__/prompt-repo.test.ts
git commit -m "feat(core): add prompt repository with CRUD and FTS5 search"
```

---

### Task 7: Core package — Classifier (keyword-based auto-categorization)

**Files:**
- Create: `packages/core/src/classifier.ts`
- Create: `packages/core/src/__tests__/classifier.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/classifier.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Classifier } from '../classifier.js';

describe('Classifier', () => {
  const classifier = new Classifier();

  it('should classify programming-related content', () => {
    const result = classifier.classify('Help me debug this Python function that raises an error');
    expect(result.category).toBe('编程');
    expect(result.tags).toContain('python');
    expect(result.tags).toContain('debug');
  });

  it('should classify writing-related content', () => {
    const result = classifier.classify('Write a professional email to my manager about project updates');
    expect(result.category).toBe('写作');
    expect(result.tags).toContain('email');
  });

  it('should classify translation-related content', () => {
    const result = classifier.classify('Translate the following text from English to Chinese');
    expect(result.category).toBe('翻译');
  });

  it('should return 其他 for unrecognized content', () => {
    const result = classifier.classify('random words with no clear pattern xyzzy');
    expect(result.category).toBe('其他');
  });

  it('should auto-generate title from content', () => {
    const title = classifier.suggestTitle('Help me debug this Python function that raises an error when called with null arguments');
    expect(title.length).toBeLessThanOrEqual(25);
    expect(title.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @promptstash/core test`
Expected: FAIL

**Step 3: Implement Classifier**

Create `packages/core/src/classifier.ts`:

```typescript
interface ClassifyResult {
  category: string;
  tags: string[];
}

interface Rule {
  category: string;
  keywords: string[];
  tagKeywords: Record<string, string[]>;
}

const RULES: Rule[] = [
  {
    category: '编程',
    keywords: ['code', 'debug', 'function', 'error', 'bug', 'api', 'implement', 'program', 'script', 'algorithm', 'class', 'method', 'variable', 'compile', 'runtime', '代码', '调试', '编程', '函数', '报错'],
    tagKeywords: {
      python: ['python', 'pip', 'django', 'flask', 'pandas'],
      javascript: ['javascript', 'js', 'node', 'react', 'vue', 'angular', 'typescript', 'ts'],
      debug: ['debug', 'error', 'fix', 'bug', 'issue', '调试', '报错'],
      api: ['api', 'rest', 'graphql', 'endpoint'],
      sql: ['sql', 'database', 'query', 'mysql', 'postgres', 'sqlite'],
    },
  },
  {
    category: '写作',
    keywords: ['write', 'essay', 'article', 'blog', 'email', 'letter', 'story', 'draft', 'copywriting', '写', '文章', '邮件', '文案'],
    tagKeywords: {
      email: ['email', 'mail', '邮件'],
      blog: ['blog', '博客'],
      copywriting: ['copy', 'ad', 'marketing', '文案', '广告'],
    },
  },
  {
    category: '翻译',
    keywords: ['translate', 'translation', 'interpret', '翻译', '英译中', '中译英'],
    tagKeywords: {
      'en-zh': ['english to chinese', '英译中', 'english.*chinese'],
      'zh-en': ['chinese to english', '中译英', 'chinese.*english'],
    },
  },
  {
    category: '分析',
    keywords: ['analyze', 'analysis', 'data', 'report', 'statistics', 'compare', '分析', '数据', '报告'],
    tagKeywords: {
      data: ['data', '数据'],
      report: ['report', '报告'],
    },
  },
  {
    category: '创意',
    keywords: ['creative', 'brainstorm', 'idea', 'design', 'imagine', '创意', '设计', '头脑风暴'],
    tagKeywords: {
      design: ['design', '设计'],
      brainstorm: ['brainstorm', '头脑风暴'],
    },
  },
];

export class Classifier {
  classify(content: string): ClassifyResult {
    const lower = content.toLowerCase();
    let bestCategory = '其他';
    let bestScore = 0;
    const allTags: Set<string> = new Set();

    for (const rule of RULES) {
      let score = 0;
      for (const kw of rule.keywords) {
        if (lower.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = rule.category;
      }
      if (score > 0) {
        for (const [tag, tagKws] of Object.entries(rule.tagKeywords)) {
          for (const tkw of tagKws) {
            if (lower.includes(tkw) || new RegExp(tkw, 'i').test(content)) {
              allTags.add(tag);
              break;
            }
          }
        }
      }
    }

    return { category: bestCategory, tags: [...allTags] };
  }

  suggestTitle(content: string): string {
    const cleaned = content.replace(/\n/g, ' ').trim();
    if (cleaned.length <= 20) return cleaned;
    return cleaned.slice(0, 20) + '...';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @promptstash/core test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/classifier.ts packages/core/src/__tests__/classifier.test.ts
git commit -m "feat(core): add keyword-based classifier for auto-categorization"
```

---

### Task 8: Core package — barrel export (index.ts)

**Files:**
- Create: `packages/core/src/index.ts`

**Step 1: Create the barrel export**

Create `packages/core/src/index.ts`:

```typescript
export { Database } from './db.js';
export { CategoryRepo } from './repositories/category-repo.js';
export { TagRepo } from './repositories/tag-repo.js';
export { PromptRepo } from './repositories/prompt-repo.js';
export { Classifier } from './classifier.js';
export type { Prompt, Category, Tag, PromptCreateInput, PromptSearchParams } from './models.js';
```

**Step 2: Build the core package**

Run: `pnpm --filter @promptstash/core build`
Expected: Compiles without error, `dist/` created

**Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): add barrel export"
```

---

## Phase 2: Electron App — Main Process

### Task 9: Scaffold Electron package

**Files:**
- Create: `packages/electron/package.json`
- Create: `packages/electron/tsconfig.json`
- Create: `packages/electron/src/main/index.ts`

**Step 1: Create packages/electron/package.json**

```json
{
  "name": "@promptstash/electron",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.main.json && vite build",
    "start": "electron dist/main/index.js"
  },
  "dependencies": {
    "@promptstash/core": "workspace:*",
    "electron": "^33.0.0",
    "fastify": "^5.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.1.0"
  }
}
```

**Step 2: Create packages/electron/tsconfig.main.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist/main",
    "rootDir": "src/main"
  },
  "include": ["src/main"]
}
```

**Note:** Electron main process uses CommonJS. The renderer (Vite) uses ESM.

**Step 3: Create minimal main process entry**

Create `packages/electron/src/main/index.ts`:

```typescript
import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open PromptStash', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('PromptStash');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

app.on('ready', () => {
  mainWindow = createMainWindow();
  createTray();

  // Hide dock icon on macOS (menubar-only app)
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault(); // Don't quit, stay in tray
});
```

**Step 4: Install dependencies**

Run: `pnpm install`

**Step 5: Commit**

```bash
git add packages/electron/ pnpm-lock.yaml
git commit -m "feat(electron): scaffold Electron package with tray setup"
```

---

### Task 10: Electron — Local HTTP Server (Fastify)

**Files:**
- Create: `packages/electron/src/main/server.ts`
- Create: `packages/core/src/__tests__/server.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/server.test.ts`:

Note: We test the API routes using Fastify's `inject()` method, no actual Electron needed.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../../electron/src/main/server.js';
import { Database } from '../db.js';
import { CategoryRepo } from '../repositories/category-repo.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('HTTP API Server', () => {
  let db: Database;
  let dbPath: string;
  let server: Awaited<ReturnType<typeof createServer>>;
  let categoryId: string;

  beforeAll(async () => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
    const catRepo = new CategoryRepo(db);
    const cat = catRepo.create({ name: '编程', sortOrder: 0 });
    categoryId = cat.id;
    server = await createServer(db);
  });

  afterAll(async () => {
    await server.close();
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('GET /api/categories should return categories', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/categories' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('编程');
  });

  it('POST /api/prompts should create a prompt', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/prompts',
      payload: {
        title: 'Test API Prompt',
        content: 'Some prompt content',
        categoryId,
        tags: ['test'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('Test API Prompt');
    expect(body.id).toBeTruthy();
  });

  it('GET /api/prompts/search should find prompts', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/prompts/search?q=API',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/prompts/classify should return suggestions', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/prompts/classify',
      payload: { content: 'Help me debug this Python function' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.category).toBe('编程');
    expect(body.tags).toContain('python');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @promptstash/core test`
Expected: FAIL — `createServer` not found

**Step 3: Implement the server**

Create `packages/electron/src/main/server.ts`:

```typescript
import Fastify from 'fastify';
import type { Database } from '@promptstash/core';
import { PromptRepo, CategoryRepo, TagRepo, Classifier } from '@promptstash/core';
import type { PromptSearchParams, PromptCreateInput } from '@promptstash/core';

export async function createServer(db: Database, port = 9877) {
  const app = Fastify({ logger: false });

  const prompts = new PromptRepo(db);
  const categories = new CategoryRepo(db);
  const tags = new TagRepo(db);
  const classifier = new Classifier();

  // --- Categories ---
  app.get('/api/categories', async () => {
    return categories.listAll();
  });

  // --- Tags ---
  app.get('/api/tags', async () => {
    return tags.listAll();
  });

  // --- Prompts ---
  app.get<{ Querystring: PromptSearchParams }>('/api/prompts/search', async (request) => {
    const { q, categoryId, tag, limit, offset } = request.query;
    return prompts.search({ q, categoryId, tag, limit: limit ? Number(limit) : undefined, offset: offset ? Number(offset) : undefined });
  });

  app.get<{ Params: { id: string } }>('/api/prompts/:id', async (request, reply) => {
    const prompt = prompts.getById(request.params.id);
    if (!prompt) return reply.status(404).send({ error: 'Not found' });
    return prompt;
  });

  app.post<{ Body: PromptCreateInput }>('/api/prompts', async (request, reply) => {
    const created = prompts.create(request.body);
    return reply.status(201).send(created);
  });

  app.post<{ Params: { id: string } }>('/api/prompts/:id/use', async (request) => {
    prompts.incrementUsage(request.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/prompts/:id/favorite', async (request) => {
    prompts.toggleFavorite(request.params.id);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/prompts/:id', async (request) => {
    prompts.delete(request.params.id);
    return { ok: true };
  });

  // --- Classify ---
  app.post<{ Body: { content: string } }>('/api/prompts/classify', async (request) => {
    const result = classifier.classify(request.body.content);
    const title = classifier.suggestTitle(request.body.content);
    return { ...result, suggestedTitle: title };
  });

  return app;
}

export async function startServer(db: Database, port = 9877) {
  const app = await createServer(db, port);
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`PromptStash API running on http://127.0.0.1:${port}`);
  return app;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @promptstash/core test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/electron/src/main/server.ts packages/core/src/__tests__/server.test.ts
git commit -m "feat(electron): add local Fastify HTTP API server"
```

---

### Task 11: Electron — Global shortcuts & floating search window

**Files:**
- Create: `packages/electron/src/main/shortcuts.ts`
- Modify: `packages/electron/src/main/index.ts`

**Step 1: Create shortcuts module**

Create `packages/electron/src/main/shortcuts.ts`:

```typescript
import { globalShortcut, BrowserWindow, clipboard, screen } from 'electron';

let searchWindow: BrowserWindow | null = null;

export function createSearchWindow(): BrowserWindow {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 680;
  const winHeight = 420;
  const x = Math.round((screenWidth - winWidth) / 2);

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y: 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('blur', () => {
    win.hide();
  });

  return win;
}

export function registerShortcuts(onSaveClipboard: () => void): void {
  // Cmd+Shift+P — toggle floating search window
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (!searchWindow) {
      searchWindow = createSearchWindow();
    }
    if (searchWindow.isVisible()) {
      searchWindow.hide();
    } else {
      searchWindow.show();
      searchWindow.focus();
    }
  });

  // Cmd+Shift+S — save clipboard content as new prompt
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    onSaveClipboard();
  });
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}
```

**Step 2: Update main/index.ts to use shortcuts and server**

Replace `packages/electron/src/main/index.ts` with:

```typescript
import { app, BrowserWindow, Tray, Menu, nativeImage, clipboard } from 'electron';
import path from 'node:path';
import { Database } from '@promptstash/core';
import { CategoryRepo, PromptRepo } from '@promptstash/core';
import { startServer } from './server.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const DB_PATH = path.join(
  app.getPath('userData'),
  'data.db'
);

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open PromptStash', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('PromptStash');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

app.on('ready', async () => {
  const db = new Database(DB_PATH);

  // Seed defaults
  const catRepo = new CategoryRepo(db);
  catRepo.seedDefaults();

  // Start local HTTP server
  await startServer(db);

  mainWindow = createMainWindow();
  createTray();

  // Register global shortcuts
  const promptRepo = new PromptRepo(db);
  registerShortcuts(() => {
    const text = clipboard.readText();
    if (text.trim()) {
      const catList = catRepo.listAll();
      const defaultCat = catList.find((c) => c.name === '其他') ?? catList[0];
      promptRepo.create({
        title: text.slice(0, 20) + (text.length > 20 ? '...' : ''),
        content: text,
        categoryId: defaultCat.id,
      });
    }
  });

  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

app.on('will-quit', () => {
  unregisterShortcuts();
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
```

**Step 3: Commit**

```bash
git add packages/electron/src/main/shortcuts.ts packages/electron/src/main/index.ts
git commit -m "feat(electron): add global shortcuts and floating search window"
```

---

## Phase 3: Chrome Extension

### Task 12: Scaffold Chrome Extension

**Files:**
- Create: `packages/chrome-extension/manifest.json`
- Create: `packages/chrome-extension/package.json`
- Create: `packages/chrome-extension/tsconfig.json`

**Step 1: Create manifest.json (Manifest V3)**

Create `packages/chrome-extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "PromptStash",
  "version": "0.1.0",
  "description": "Save and insert prompts across AI tools",
  "permissions": ["contextMenus", "activeTab"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "https://chat.openai.com/*",
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*"
      ],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "icons": {
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

**Step 2: Create package.json**

Create `packages/chrome-extension/package.json`:

```json
{
  "name": "@promptstash/chrome-extension",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.287",
    "typescript": "^5.7.0",
    "vite": "^6.1.0"
  }
}
```

**Step 3: Create tsconfig.json**

Create `packages/chrome-extension/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

**Step 4: Install dependencies**

Run: `pnpm install`

**Step 5: Commit**

```bash
git add packages/chrome-extension/
git commit -m "feat(extension): scaffold Chrome Extension Manifest V3"
```

---

### Task 13: Chrome Extension — Background service worker

**Files:**
- Create: `packages/chrome-extension/src/background.ts`
- Create: `packages/chrome-extension/src/api-client.ts`

**Step 1: Create the API client**

Create `packages/chrome-extension/src/api-client.ts`:

```typescript
const BASE_URL = 'http://127.0.0.1:9877';

export interface ClassifyResponse {
  category: string;
  tags: string[];
  suggestedTitle: string;
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
```

**Step 2: Create the background service worker**

Create `packages/chrome-extension/src/background.ts`:

```typescript
import { api } from './api-client.js';

// Context menu: "Save to PromptStash"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-promptstash',
    title: 'Save to PromptStash',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-promptstash' && info.selectionText) {
    const text = info.selectionText;
    const source = tab?.url ? new URL(tab.url).hostname : undefined;

    try {
      const classification = await api.classify(text);
      const categories = await api.getCategories();
      const matchedCat = categories.find((c: any) => c.name === classification.category);

      if (!matchedCat) {
        console.error('No matching category found');
        return;
      }

      // Send data to popup for user confirmation
      chrome.storage.local.set({
        pendingSave: {
          content: text,
          suggestedTitle: classification.suggestedTitle,
          categoryId: matchedCat.id,
          categoryName: matchedCat.name,
          tags: classification.tags,
          source,
          categories,
        },
      });

      // Open popup for confirmation
      if (tab?.id) {
        chrome.action.openPopup();
      }
    } catch (err) {
      console.error('PromptStash save error:', err);
    }
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'search') {
    api.searchPrompts(message.query).then(sendResponse).catch(() => sendResponse([]));
    return true; // async response
  }
  if (message.type === 'recordUsage') {
    api.recordUsage(message.id).then(() => sendResponse({ ok: true }));
    return true;
  }
});
```

**Step 3: Commit**

```bash
git add packages/chrome-extension/src/api-client.ts packages/chrome-extension/src/background.ts
git commit -m "feat(extension): add background service worker with context menu and API client"
```

---

### Task 14: Chrome Extension — Content script (trigger word detection)

**Files:**
- Create: `packages/chrome-extension/src/content.ts`
- Create: `packages/chrome-extension/src/content.css`

**Step 1: Create the content script**

Create `packages/chrome-extension/src/content.ts`:

```typescript
const TRIGGER = '/p ';
const TRIGGER_ALT = ';p ';

interface PromptResult {
  id: string;
  title: string;
  content: string;
}

let dropdown: HTMLElement | null = null;
let activeInput: HTMLElement | null = null;

function createDropdown(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'promptstash-dropdown';
  el.style.cssText = `
    position: fixed;
    z-index: 99999;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-height: 300px;
    width: 360px;
    overflow-y: auto;
    display: none;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
  `;
  document.body.appendChild(el);
  return el;
}

function positionDropdown(target: HTMLElement): void {
  if (!dropdown) return;
  const rect = target.getBoundingClientRect();
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom + 4}px`;
}

function showResults(results: PromptResult[]): void {
  if (!dropdown) dropdown = createDropdown();
  dropdown.innerHTML = '';
  if (results.length === 0) {
    dropdown.innerHTML = '<div style="padding:12px;color:#999;">No prompts found</div>';
  } else {
    for (const r of results) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;';
      item.innerHTML = `<div style="font-weight:600;">${escapeHtml(r.title)}</div>
        <div style="color:#666;font-size:12px;margin-top:2px;">${escapeHtml(r.content.slice(0, 60))}...</div>`;
      item.addEventListener('mouseenter', () => { item.style.background = '#f5f5f5'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'white'; });
      item.addEventListener('click', () => {
        insertPrompt(r);
        hideDropdown();
      });
      dropdown.appendChild(item);
    }
  }
  dropdown.style.display = 'block';
}

function hideDropdown(): void {
  if (dropdown) dropdown.style.display = 'none';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function insertPrompt(prompt: PromptResult): void {
  if (!activeInput) return;

  if (activeInput instanceof HTMLTextAreaElement || activeInput instanceof HTMLInputElement) {
    const val = activeInput.value;
    const triggerIdx = Math.max(val.lastIndexOf(TRIGGER), val.lastIndexOf(TRIGGER_ALT));
    if (triggerIdx >= 0) {
      activeInput.value = val.slice(0, triggerIdx) + prompt.content;
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (activeInput.isContentEditable) {
    const text = activeInput.textContent ?? '';
    const triggerIdx = Math.max(text.lastIndexOf(TRIGGER), text.lastIndexOf(TRIGGER_ALT));
    if (triggerIdx >= 0) {
      activeInput.textContent = text.slice(0, triggerIdx) + prompt.content;
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Record usage
  chrome.runtime.sendMessage({ type: 'recordUsage', id: prompt.id });
}

function handleInput(e: Event): void {
  const target = e.target as HTMLElement;
  let text = '';

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    text = target.value;
  } else if (target.isContentEditable) {
    text = target.textContent ?? '';
  } else {
    return;
  }

  const hasTrigger = text.includes(TRIGGER) || text.includes(TRIGGER_ALT);
  if (!hasTrigger) {
    hideDropdown();
    return;
  }

  activeInput = target;
  const triggerIdx = Math.max(text.lastIndexOf(TRIGGER), text.lastIndexOf(TRIGGER_ALT));
  const triggerLen = text.includes(TRIGGER) ? TRIGGER.length : TRIGGER_ALT.length;
  const query = text.slice(triggerIdx + triggerLen).trim();

  if (query.length === 0) {
    // Show recent/popular
    chrome.runtime.sendMessage({ type: 'search', query: '' }, (results) => {
      positionDropdown(target);
      showResults(results ?? []);
    });
  } else {
    chrome.runtime.sendMessage({ type: 'search', query }, (results) => {
      positionDropdown(target);
      showResults(results ?? []);
    });
  }
}

// Listen on the whole document (captures dynamic inputs)
document.addEventListener('input', handleInput, true);

// Close dropdown on click outside
document.addEventListener('click', (e) => {
  if (dropdown && !dropdown.contains(e.target as Node)) {
    hideDropdown();
  }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideDropdown();
});
```

**Step 2: Create content.css**

Create `packages/chrome-extension/src/content.css`:

```css
#promptstash-dropdown::-webkit-scrollbar {
  width: 6px;
}

#promptstash-dropdown::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}
```

**Step 3: Commit**

```bash
git add packages/chrome-extension/src/content.ts packages/chrome-extension/src/content.css
git commit -m "feat(extension): add content script with trigger word detection and inline search"
```

---

### Task 15: Chrome Extension — Save popup (React)

**Files:**
- Create: `packages/chrome-extension/src/popup.html`
- Create: `packages/chrome-extension/src/popup.tsx`

**Step 1: Create popup.html**

Create `packages/chrome-extension/src/popup.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { width: 380px; min-height: 200px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

**Step 2: Create popup.tsx**

Create `packages/chrome-extension/src/popup.tsx`:

```tsx
import { api } from './api-client.js';

interface PendingSave {
  content: string;
  suggestedTitle: string;
  categoryId: string;
  categoryName: string;
  tags: string[];
  source?: string;
  categories: { id: string; name: string }[];
}

async function init() {
  const root = document.getElementById('root')!;

  const data = await chrome.storage.local.get('pendingSave');
  const pending = data.pendingSave as PendingSave | undefined;

  if (!pending) {
    root.innerHTML = `
      <div style="padding:20px;text-align:center;">
        <h3 style="margin:0 0 8px;">PromptStash</h3>
        <p style="color:#666;font-size:13px;">Select text on any AI page, right-click, and choose "Save to PromptStash"</p>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div style="padding:16px;">
      <h3 style="margin:0 0 12px;">Save Prompt</h3>
      <label style="display:block;margin-bottom:8px;font-size:13px;color:#555;">Title</label>
      <input id="title" type="text" value="${escapeAttr(pending.suggestedTitle)}"
        style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;margin-bottom:12px;" />

      <label style="display:block;margin-bottom:8px;font-size:13px;color:#555;">Category</label>
      <select id="category" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:12px;">
        ${pending.categories.map((c) =>
          `<option value="${c.id}" ${c.id === pending.categoryId ? 'selected' : ''}>${c.name}</option>`
        ).join('')}
      </select>

      <label style="display:block;margin-bottom:8px;font-size:13px;color:#555;">Tags</label>
      <input id="tags" type="text" value="${pending.tags.join(', ')}"
        style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;margin-bottom:12px;"
        placeholder="comma separated" />

      <div style="color:#999;font-size:12px;margin-bottom:12px;max-height:60px;overflow-y:auto;">
        ${escapeHtml(pending.content.slice(0, 200))}${pending.content.length > 200 ? '...' : ''}
      </div>

      <button id="save-btn"
        style="width:100%;padding:10px;background:#4F46E5;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
        Save
      </button>
      <div id="status" style="margin-top:8px;text-align:center;font-size:13px;"></div>
    </div>`;

  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const title = (document.getElementById('title') as HTMLInputElement).value.trim();
    const categoryId = (document.getElementById('category') as HTMLSelectElement).value;
    const tagsStr = (document.getElementById('tags') as HTMLInputElement).value;
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    const statusEl = document.getElementById('status')!;

    try {
      await api.createPrompt({
        title: title || pending.suggestedTitle,
        content: pending.content,
        categoryId,
        tags,
        source: pending.source,
      });
      statusEl.style.color = '#16a34a';
      statusEl.textContent = 'Saved!';
      await chrome.storage.local.remove('pendingSave');
      setTimeout(() => window.close(), 800);
    } catch (err) {
      statusEl.style.color = '#dc2626';
      statusEl.textContent = 'Error: Is PromptStash desktop app running?';
    }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}

init();
```

**Step 3: Commit**

```bash
git add packages/chrome-extension/src/popup.html packages/chrome-extension/src/popup.tsx
git commit -m "feat(extension): add save popup with auto-classification"
```

---

## Phase 4: Alfred Workflow

### Task 16: Alfred Workflow — Search and Save

**Files:**
- Create: `packages/alfred-workflow/package.json`
- Create: `packages/alfred-workflow/src/search.ts`
- Create: `packages/alfred-workflow/src/save.ts`
- Create: `packages/alfred-workflow/info.plist`

**Step 1: Create package.json**

Create `packages/alfred-workflow/package.json`:

```json
{
  "name": "@promptstash/alfred-workflow",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create search script**

Create `packages/alfred-workflow/src/search.ts`:

```typescript
const BASE_URL = 'http://127.0.0.1:9877';

interface AlfredItem {
  title: string;
  subtitle: string;
  arg: string;
  uid: string;
}

async function main() {
  const query = process.argv[2] ?? '';

  try {
    const res = await fetch(
      `${BASE_URL}/api/prompts/search?q=${encodeURIComponent(query)}&limit=20`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const prompts = await res.json();

    const items: AlfredItem[] = prompts.map((p: any) => ({
      uid: p.id,
      title: p.title,
      subtitle: p.content.slice(0, 80),
      arg: p.content,
    }));

    console.log(JSON.stringify({ items }));
  } catch {
    console.log(
      JSON.stringify({
        items: [
          {
            title: 'PromptStash not running',
            subtitle: 'Please start the PromptStash desktop app',
            arg: '',
            valid: false,
          },
        ],
      })
    );
  }
}

main();
```

**Step 3: Create save script**

Create `packages/alfred-workflow/src/save.ts`:

```typescript
const BASE_URL = 'http://127.0.0.1:9877';

async function main() {
  const title = process.argv[2] ?? 'Untitled';
  const { execSync } = await import('node:child_process');
  const content = execSync('pbpaste').toString().trim();

  if (!content) {
    console.log('Clipboard is empty');
    return;
  }

  try {
    // Classify first
    const classifyRes = await fetch(`${BASE_URL}/api/prompts/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const classification = await classifyRes.json();

    // Get categories
    const catRes = await fetch(`${BASE_URL}/api/categories`);
    const categories = await catRes.json();
    const matchedCat = categories.find((c: any) => c.name === classification.category) ?? categories[0];

    // Save
    const saveRes = await fetch(`${BASE_URL}/api/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content,
        categoryId: matchedCat.id,
        tags: classification.tags,
      }),
    });

    if (saveRes.ok) {
      console.log(`Saved: ${title}`);
    } else {
      console.log('Failed to save');
    }
  } catch {
    console.log('PromptStash not running');
  }
}

main();
```

**Step 4: Create minimal info.plist placeholder**

Create `packages/alfred-workflow/info.plist` — this is a placeholder; real configuration is done in Alfred's UI. Include a comment at the top:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>name</key>
  <string>PromptStash</string>
  <key>description</key>
  <string>Search and save prompts via PromptStash</string>
  <key>bundleid</key>
  <string>com.promptstash.alfred</string>
  <key>readme</key>
  <string>
Triggers:
  pp {query} — Search prompts (Enter to copy)
  ps {title} — Save clipboard as prompt
  </string>
</dict>
</plist>
```

**Step 5: Install dependencies and commit**

Run: `pnpm install`

```bash
git add packages/alfred-workflow/ pnpm-lock.yaml
git commit -m "feat(alfred): add Alfred Workflow for search and save"
```

---

## Phase 5: Electron Renderer UI

### Task 17: Electron Renderer — Vite + React + Tailwind setup

**Files:**
- Create: `packages/electron/vite.config.ts`
- Create: `packages/electron/src/renderer/index.html`
- Create: `packages/electron/src/renderer/main.tsx`
- Create: `packages/electron/src/renderer/App.tsx`
- Create: `packages/electron/tailwind.config.ts`
- Create: `packages/electron/postcss.config.js`

**Step 1: Create vite.config.ts**

Create `packages/electron/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
});
```

**Step 2: Create index.html**

Create `packages/electron/src/renderer/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PromptStash</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**Step 3: Create main.tsx**

Create `packages/electron/src/renderer/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

**Step 4: Create index.css**

Create `packages/electron/src/renderer/index.css`:

```css
@import "tailwindcss";
```

**Step 5: Create App.tsx (basic shell)**

Create `packages/electron/src/renderer/App.tsx`:

```tsx
import { useState, useEffect } from 'react';

const API = 'http://127.0.0.1:9877';

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface Prompt {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  tags: string[];
  usageCount: number;
  isFavorite: boolean;
  updatedAt: string;
}

export function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    fetch(`${API}/api/categories`).then((r) => r.json()).then(setCategories);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategoryId) params.set('categoryId', selectedCategoryId);
    fetch(`${API}/api/prompts/search?${params}`).then((r) => r.json()).then(setPrompts);
  }, [searchQuery, selectedCategoryId]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar: categories */}
      <aside className="w-56 bg-white border-r p-4 flex flex-col gap-1">
        <h2 className="text-lg font-bold mb-3">PromptStash</h2>
        <button
          className={`text-left px-3 py-2 rounded text-sm ${!selectedCategoryId ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'}`}
          onClick={() => setSelectedCategoryId(null)}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`text-left px-3 py-2 rounded text-sm ${selectedCategoryId === c.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'}`}
            onClick={() => setSelectedCategoryId(c.id)}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </aside>

      {/* Main: prompt list */}
      <main className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {prompts.map((p) => (
            <div
              key={p.id}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedPrompt?.id === p.id ? 'bg-indigo-50' : ''}`}
              onClick={() => setSelectedPrompt(p)}
            >
              <div className="font-medium text-sm">{p.title}</div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{p.content}</div>
              <div className="flex gap-1 mt-2">
                {p.tags.map((t) => (
                  <span key={t} className="text-xs bg-gray-200 px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </div>
          ))}
          {prompts.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">No prompts yet</div>
          )}
        </div>
      </main>

      {/* Detail panel */}
      {selectedPrompt && (
        <aside className="w-80 bg-white border-l p-4 flex flex-col">
          <h3 className="font-bold text-sm mb-2">{selectedPrompt.title}</h3>
          <pre className="flex-1 text-xs whitespace-pre-wrap bg-gray-50 p-3 rounded overflow-y-auto">
            {selectedPrompt.content}
          </pre>
          <div className="mt-3 flex gap-2">
            <button
              className="flex-1 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
              onClick={() => navigator.clipboard.writeText(selectedPrompt.content)}
            >
              Copy
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add packages/electron/vite.config.ts packages/electron/src/renderer/ packages/electron/postcss.config.js packages/electron/tailwind.config.ts
git commit -m "feat(electron): add React + Tailwind renderer UI"
```

---

### Task 18: Electron Renderer — Floating search window

**Files:**
- Create: `packages/electron/src/renderer/SearchWindow.tsx`
- Create: `packages/electron/src/renderer/search.html`
- Create: `packages/electron/src/renderer/search-main.tsx`

**Step 1: Create search.html**

Create `packages/electron/src/renderer/search.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PromptStash Search</title>
  <style>
    body { margin: 0; background: transparent; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./search-main.tsx"></script>
</body>
</html>
```

**Step 2: Create search-main.tsx**

Create `packages/electron/src/renderer/search-main.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import { SearchWindow } from './SearchWindow.js';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(<SearchWindow />);
```

**Step 3: Create SearchWindow.tsx**

Create `packages/electron/src/renderer/SearchWindow.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';

const API = 'http://127.0.0.1:9877';

interface Prompt {
  id: string;
  title: string;
  content: string;
  tags: string[];
  usageCount: number;
}

export function SearchWindow() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Prompt[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', '10');
    fetch(`${API}/api/prompts/search?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setSelectedIdx(0);
      });
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      navigator.clipboard.writeText(results[selectedIdx].content);
      // Record usage
      fetch(`${API}/api/prompts/${results[selectedIdx].id}/use`, { method: 'POST' });
      window.close();
    } else if (e.key === 'Escape') {
      window.close();
    }
  };

  return (
    <div className="rounded-xl overflow-hidden bg-white/95 backdrop-blur-xl shadow-2xl border border-gray-200">
      <div className="p-3">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search prompts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-3 text-lg bg-transparent outline-none"
        />
      </div>
      {results.length > 0 && (
        <div className="border-t max-h-72 overflow-y-auto">
          {results.map((p, i) => (
            <div
              key={p.id}
              className={`px-4 py-3 cursor-pointer ${i === selectedIdx ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
              onClick={() => {
                navigator.clipboard.writeText(p.content);
                fetch(`${API}/api/prompts/${p.id}/use`, { method: 'POST' });
                window.close();
              }}
            >
              <div className="font-medium text-sm">{p.title}</div>
              <div className="text-xs text-gray-500 mt-1 truncate">{p.content.slice(0, 80)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add packages/electron/src/renderer/SearchWindow.tsx packages/electron/src/renderer/search.html packages/electron/src/renderer/search-main.tsx
git commit -m "feat(electron): add Spotlight-style floating search window"
```

---

## Phase 6: Build & Integration

### Task 19: Vite config for Chrome Extension build

**Files:**
- Create: `packages/chrome-extension/vite.config.ts`

**Step 1: Create Vite config**

Create `packages/chrome-extension/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        popup: resolve(__dirname, 'src/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
```

**Step 2: Test build**

Run: `pnpm --filter @promptstash/chrome-extension build`
Expected: Builds to `dist/` without errors

**Step 3: Copy manifest and static files (add a build script)**

Add to `packages/chrome-extension/package.json` scripts:

```json
"postbuild": "cp manifest.json dist/ && mkdir -p dist/icons"
```

**Step 4: Commit**

```bash
git add packages/chrome-extension/vite.config.ts packages/chrome-extension/package.json
git commit -m "feat(extension): add Vite build config"
```

---

### Task 20: Import/Export feature in core

**Files:**
- Create: `packages/core/src/import-export.ts`
- Create: `packages/core/src/__tests__/import-export.test.ts`

**Step 1: Write the failing test**

Create `packages/core/src/__tests__/import-export.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { PromptRepo } from '../repositories/prompt-repo.js';
import { CategoryRepo } from '../repositories/category-repo.js';
import { exportAll, importAll } from '../import-export.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('Import/Export', () => {
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(path.dirname(dbPath));
  });

  it('should export and import data roundtrip', () => {
    const catRepo = new CategoryRepo(db);
    const promptRepo = new PromptRepo(db);

    const cat = catRepo.create({ name: '编程', sortOrder: 0 });
    promptRepo.create({ title: 'Test', content: 'Content', categoryId: cat.id, tags: ['python'] });

    const exported = exportAll(db);
    expect(exported.prompts).toHaveLength(1);
    expect(exported.categories).toHaveLength(1);

    // Import into fresh DB
    const dbPath2 = createTempDbPath();
    const db2 = new Database(dbPath2);
    importAll(db2, exported);

    const promptRepo2 = new PromptRepo(db2);
    const results = promptRepo2.search({});
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Test');

    db2.close();
    fs.unlinkSync(dbPath2);
    fs.rmdirSync(path.dirname(dbPath2));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @promptstash/core test`
Expected: FAIL

**Step 3: Implement import/export**

Create `packages/core/src/import-export.ts`:

```typescript
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
```

**Step 4: Add to barrel export**

Update `packages/core/src/index.ts` — add:

```typescript
export { exportAll, importAll } from './import-export.js';
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @promptstash/core test`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/import-export.ts packages/core/src/__tests__/import-export.test.ts packages/core/src/index.ts
git commit -m "feat(core): add JSON import/export with roundtrip support"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-8 | Monorepo scaffold + core package (models, DB, repos, classifier) |
| 2 | 9-11 | Electron main process (tray, HTTP server, global shortcuts) |
| 3 | 12-15 | Chrome Extension (background, content script, popup) |
| 4 | 16 | Alfred Workflow (search + save scripts) |
| 5 | 17-18 | Electron renderer UI (management + floating search) |
| 6 | 19-20 | Build config + import/export |

**Total:** 20 tasks, each following TDD where applicable with exact file paths and code.
