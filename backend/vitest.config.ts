import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      DATABASE_URL: ':memory:',
    },
    setupFiles: ['./src/test/setup.ts'],
  },
});
