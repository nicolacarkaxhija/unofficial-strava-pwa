import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // exactOptionalPropertyTypes: omit the key entirely rather than setting it to
  // undefined, since PlaywrightTestConfig marks `workers` as optional (not optional|undefined).
  ...(process.env['CI'] ? { workers: 1 as const } : {}),
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    // Dedicated port (not Vite's default 5173, and not the Oura sibling's 5199):
    // with reuseExistingServer, any other Vite project running on the default
    // port would silently get tested instead of this app. --strictPort makes a
    // collision a loud failure.
    baseURL: 'http://localhost:5399',
    trace: 'on-first-retry',
  },
  projects: [
    // E2E tests run in Chromium only — the app is cross-browser but the test
    // scenarios (ZIP upload, IndexedDB behaviour) are identical across engines.
    // WebKit and Firefox can be added when cross-browser regressions appear.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5399 --strictPort',
    url: 'http://localhost:5399',
    reuseExistingServer: !process.env['CI'],
  },
})
