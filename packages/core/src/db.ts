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
