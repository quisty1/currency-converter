import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub project pages are served from /<repository>/, not the domain root.
  base: '/currency-converter/',
  build: {
    rollupOptions: {
      output: {
        // Keep large framework and data dependencies in stable, cacheable chunks.
        manualChunks: {
          mui: [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
          ],
          data: ['@tanstack/react-query', 'zustand', 'zod'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'FX Multi — Currency Converter',
        short_name: 'FX Multi',
        description:
          'Convert one amount into multiple fiat and crypto currencies.',
        theme_color: '#3159d9',
        background_color: '#f4f6fb',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Prefer fresh rates while retaining cached data for offline use.
            urlPattern: /^https:\/\/(open\.er-api\.com|api\.coingecko\.com)\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fx-rates',
              networkTimeoutSeconds: 8,
              expiration: { maxAgeSeconds: 21600 },
            },
          },
          {
            // Currency flags are immutable enough to cache for a month.
            urlPattern: /^https:\/\/flagcdn\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'currency-flags',
              expiration: { maxEntries: 180, maxAgeSeconds: 2592000 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    // Unit and component tests run in a browser-like DOM environment.
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: {
        statements: 80,
        branches: 68,
        functions: 80,
        lines: 82,
      },
    },
  },
});
