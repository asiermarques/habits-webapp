import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Brand tokens from docs/DESIGN.md ("Quiet Discipline" palette).
const PAPER = '#F4F0E8'; // --paper: app background / splash background

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // PWA manifest + icons (US-001). The service worker stays dormant here:
    // `injectRegister: false` means nothing is registered, so there is no
    // offline behaviour yet — registration, precache and the update flow are
    // owned by US-002. Disabled entirely under the e2e harness (`--mode e2e`).
    VitePWA({
      disable: mode === 'e2e',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
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
}));
