import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      DATABASE_URL: ':memory:',
      // Keep tests hermetic: a local .env with GATE_PASSWORD/SESSION_SECRET would
      // otherwise be loaded by `dotenv/config` and gate every data endpoint (401).
      // dotenv won't override an already-set var, so pinning these empty disables
      // the gate regardless of the developer's .env.
      GATE_PASSWORD: '',
      SESSION_SECRET: '',
    },
    setupFiles: ['./src/test-setup.ts'],
  },
});
