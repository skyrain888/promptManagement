import path from 'node:path';
import os from 'node:os';
import { Database, CategoryRepo } from '@promptstash/core';
import { createServer } from '../packages/electron/src/main/server.js';

async function main() {
  const dbPath = process.env.PROMPTSTASH_DB
    ?? path.join(os.tmpdir(), 'promptstash-dev.db');

  console.log(`Database: ${dbPath}`);

  const db = new Database(dbPath);
  const catRepo = new CategoryRepo(db);
  catRepo.seedDefaults();

  const app = await createServer(db, 9877);
  await app.listen({ port: 9877, host: '127.0.0.1' });
  console.log('PromptStash API running on http://127.0.0.1:9877');
}

main();
