import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = 4001;
const FRONTEND_PORT = 4173;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  // Serial execution is required: all specs share one backend DB with global
  // singletons (user list, default user, currency) and no per-spec cleanup, so
  // running spec files concurrently makes them race on shared state.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      name: 'backend',
      // Kill any stale process on this port first so we always start fresh with
      // the e2e env vars (GATE_PASSWORD='') rather than reusing a dev server
      // that may have been started with a different config.
      command: `(lsof -ti tcp:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true) && npm run dev:e2e --workspace=backend`,
      url: `${BACKEND_URL}/health`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DATABASE_URL: './habits.e2e.db',
        PORT: String(BACKEND_PORT),
        CORS_ORIGIN: FRONTEND_URL,
        GATE_PASSWORD: '',
        SESSION_SECRET: '',
      },
    },
    {
      name: 'frontend',
      command: 'npm run dev:e2e --workspace=frontend',
      url: FRONTEND_URL,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
