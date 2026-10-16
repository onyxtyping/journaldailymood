import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // fake-indexeddb має з'явитися до імпорту Dexie
    setupFiles: ['fake-indexeddb/auto'],
  },
});
