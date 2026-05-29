import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // vite-plugin-pwa only synthesises this virtual module during a build;
      // alias it to a no-op stub so PwaUpdatePrompt resolves under vitest.
      'virtual:pwa-register/react': path.resolve(
        __dirname,
        './src/test/pwa-register-react-stub.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
