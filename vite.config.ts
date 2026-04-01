import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    // Tailwind v4 integrates as a Vite plugin rather than a PostCSS plugin.
    // No tailwind.config.js is needed; configuration lives in src/styles.css.
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // The service worker pre-caches the app shell so the PWA works fully
      // offline after first install. Safari's 7-day eviction policy wipes
      // IndexedDB but NOT the service worker cache, so the app shell always
      // loads even if data needs re-importing.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [],
      },
      manifest: {
        name: 'Strava Data Viewer',
        short_name: 'Strava Data',
        description:
          'View your Strava activity history offline and privately — powered by your GDPR data export',
        theme_color: '#f8fafc',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512-maskable.png',
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
      // Mirrors the `paths` in tsconfig.json. Both must stay in sync.
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // ─── Manual chunk splitting ────────────────────────────────────────
        //
        // Without manualChunks, Rollup duplicates a shared library into every
        // lazy page chunk that imports it. Forcing these libraries into single
        // shared chunks means they are fetched once and cached, regardless of
        // how many pages import them.
        manualChunks: {
          // Dexie is the IndexedDB wrapper used by every db/hooks call.
          // It should never appear duplicated in page chunks.
          dexie: ['dexie'],
          // i18next is large enough (~70 kB) to warrant its own chunk so it
          // can be cached independently of app logic changes.
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
  },
  // Vite supports Web Workers natively via `new Worker(new URL('./worker.ts', import.meta.url))`.
  // No extra config is needed; this comment documents the pattern agents should follow.
})
