import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@promptstash/core': path.resolve(__dirname, 'src/index.ts'),
      '@promptstash/electron': path.resolve(__dirname, '../electron/src'),
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
