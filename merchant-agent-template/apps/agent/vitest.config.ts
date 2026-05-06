import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/scripts/**', 'src/**/index.ts'],
      reporter: ['text', 'html'],
    },
    // Each test gets a fresh in-memory SQLite — no parallel writes to one DB
    pool: 'forks',
  },
});
