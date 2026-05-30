import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Brand tokens from docs/DESIGN.md ("Quiet Discipline" palette).
const PAPER = '#F4F0E8'; // --paper: app background / splash background

export default defineConfig(({ mode }) => {
  // Load all env vars (third arg '' = no prefix filter) so we can expose a few
  // un-prefixed, build-tool-agnostic names through `define` below, rather than
  // forcing a VITE_ prefix onto app config. See GateGuard for the consumer.
  const env = loadEnv(mode, process.cwd(), '');

  return {
  define: {
    // GATE_OFFLINE_GRACE_MINUTES: how long a gated instance stays readable
    // offline after the last online unlock. Exposed un-prefixed (Vite only
    // auto-exposes VITE_*; `define` is the documented escape hatch).
    'import.meta.env.GATE_OFFLINE_GRACE_MINUTES': JSON.stringify(
      env.GATE_OFFLINE_GRACE_MINUTES ?? '',
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    // PWA manifest + icons (US-001) and the service worker (US-002 + US-003).
    // `injectRegister: false` because PwaUpdatePrompt registers the worker via
    // `useRegisterSW`; `registerType: 'prompt'` surfaces a "refresh to update"
    // toast so installed users move to a new build without pinning to an old
    // worker. Built only by `vite build` (dev `vite dev` has no worker) and
    // disabled entirely under the e2e harness (`--mode e2e`).
    VitePWA({
      disable: mode === 'e2e',
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        // Precache the built app shell so it opens offline (US-002).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,
        // SPA fallback: offline navigations to /, /metrics, /settings resolve to
        // the precached index.html. API requests are never document navigations,
        // but deny them explicitly as a guard.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // US-003: read-only offline cache of API GETs. Network-first so online
          // users always get fresh data; the cache is only a fallback offline.
          // Keyed by full URL, so userId/cursor/today variants are distinct.
          // Auth/gate endpoints are deliberately excluded so an expired gate is
          // never satisfied from cache (RISK-G1). Only 200s are cached (no
          // errors); non-GET methods never match.
          {
            urlPattern: ({ url, request }: { url: URL; request: Request }) =>
              request.method === 'GET' &&
              url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'habits-api-cache',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          // RISK-G3: keep the shell's type legible offline by caching the
          // cross-origin Google Fonts stylesheet and font files at runtime.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        id: '/',
        name: 'Habits — a quiet practice',
        short_name: 'Habits',
        description: 'A private ledger of small daily acts.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'en',
        dir: 'ltr',
        theme_color: PAPER,
        background_color: PAPER,
        categories: ['productivity', 'lifestyle'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  };
});
