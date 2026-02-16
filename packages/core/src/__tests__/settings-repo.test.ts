import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../db.js';
import { SettingsRepo } from '../repositories/settings-repo.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstash-test-'));
  return path.join(dir, 'test.db');
}

describe('SettingsRepo', () => {
  let db: Database;
  let settings: SettingsRepo;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    db = new Database(dbPath);
    settings = new SettingsRepo(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('should return undefined for non-existent key', () => {
    expect(settings.get('nonexistent')).toBeUndefined();
  });

  it('should set and get a value', () => {
    settings.set('foo', 'bar');
    expect(settings.get('foo')).toBe('bar');
  });

  it('should upsert on set', () => {
    settings.set('key', 'value1');
    settings.set('key', 'value2');
    expect(settings.get('key')).toBe('value2');
  });

  it('should delete a key', () => {
    settings.set('key', 'value');
    settings.delete('key');
    expect(settings.get('key')).toBeUndefined();
  });

  it('should return all settings', () => {
    settings.set('a', '1');
    settings.set('b', '2');
    const all = settings.getAll();
    expect(all).toEqual({ a: '1', b: '2' });
  });

  it('should return default LLM config when no settings exist', () => {
    const config = settings.getLLMConfig();
    expect(config.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
    expect(config.apiKey).toBe('sk-903b132fac034b8398ab3c9e17939ab2');
    expect(config.model).toBe('qwen-plus-latest');
  });

  it('should update and retrieve LLM config', () => {
    settings.setLLMConfig({ model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1' });
    const config = settings.getLLMConfig();
    expect(config.model).toBe('gpt-4o');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    // apiKey should still be the default
    expect(config.apiKey).toBe('sk-903b132fac034b8398ab3c9e17939ab2');
  });

  it('should partially update LLM config', () => {
    settings.setLLMConfig({ apiKey: 'sk-new-key' });
    const config = settings.getLLMConfig();
    expect(config.apiKey).toBe('sk-new-key');
    expect(config.model).toBe('qwen-plus-latest');
  });
});
