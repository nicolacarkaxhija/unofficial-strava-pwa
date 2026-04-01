import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Only run unit tests. e2e specs live in tests/e2e/ and are driven by
    // Playwright via a separate playwright.config.ts — Vitest must not pick
    // them up because @playwright/test throws when loaded outside its runner.
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    // jsdom gives us a DOM environment so React components can render,
    // and fake-indexeddb can polyfill IndexedDB without a real browser.
    environment: 'jsdom',
    // The fake-indexeddb registration must come first: src/db/client.ts
    // constructs its Dexie singleton at import time and needs a global
    // indexedDB to exist before any test file's module graph is evaluated.
    setupFiles: ['./tests/unit/setup.fake-indexeddb.ts', './tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Only measure coverage on implementation code, not tests or stubs
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/router.tsx', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
