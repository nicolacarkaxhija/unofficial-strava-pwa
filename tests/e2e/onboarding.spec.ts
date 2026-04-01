// ─── Onboarding E2E ──────────────────────────────────────────────────────────
//
// Covers the full first-run → import → data-persistence → error lifecycle.
// Each test controls browser state explicitly: fresh contexts get no data,
// seeded contexts receive a real fixture ZIP via file upload.
//
// Why we don't mock IndexedDB here:
//   The whole point of onboarding is that the import worker writes to Dexie
//   and the app then reads from it. Mocking either direction would reduce
//   these to smoke tests. Instead we upload a real ZIP and wait for the UI
//   to react.

import { test, expect } from '@playwright/test'
import { createFixtureZipFile, createCorruptZipFile } from './helpers/fixtureZip'
import { importFixture, workerTmpDir } from './helpers/importFlow'

test('fresh visit with no data shows onboarding screen with import button', async ({
  page,
  context,
}) => {
  // A brand-new browser context has empty IndexedDB — exactly the state a
  // first-time user would have. No setup needed.
  await context.clearCookies()

  await page.goto('/')

  await expect(page.getByText('Connect your Strava data')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import ZIP' })).toBeVisible()
  // Legal line: not affiliated with Strava.
  await expect(page.getByText('Not affiliated with Strava', { exact: false })).toBeVisible()
})

test('uploading fixture ZIP shows progress then the dashboard week stats', async ({
  page,
}, testInfo) => {
  const zipPath = await createFixtureZipFile(workerTmpDir(testInfo.parallelIndex))

  await page.goto('/')
  await expect(page.getByText('Connect your Strava data')).toBeVisible()

  await page.setInputFiles('[data-testid="zip-input"]', zipPath)

  // A progress bar (role="progressbar") should appear while the import worker
  // is processing — we don't assert aria-valuenow because it changes rapidly.
  await expect(page.getByRole('progressbar')).toBeVisible()

  await expect(page.getByText('Connect your Strava data')).not.toBeVisible({ timeout: 30_000 })

  // Dashboard shows the four "this week" tiles.
  await expect(page.getByTestId('week-stat-distance')).toBeVisible()
  await expect(page.getByTestId('week-stat-time')).toBeVisible()
  await expect(page.getByTestId('week-stat-elevation')).toBeVisible()
  await expect(page.getByTestId('week-stat-activities')).toBeVisible()
})

test('after import, refresh page persists data (no onboarding)', async ({ page }, testInfo) => {
  await importFixture(page, testInfo.parallelIndex)

  // Full page reload — IndexedDB persists across navigations in the same
  // browser context, so the app should skip onboarding entirely.
  await page.reload()

  await expect(page.getByText('Connect your Strava data')).not.toBeVisible()
  await expect(page.getByTestId('week-stats')).toBeVisible()
})

test('corrupt ZIP shows a readable error and stays on onboarding', async ({ page }, testInfo) => {
  const corruptPath = createCorruptZipFile(workerTmpDir(testInfo.parallelIndex))

  await page.goto('/')
  await page.setInputFiles('[data-testid="zip-input"]', corruptPath)

  // The worker posts a typed error; the page must surface it as an alert and
  // return to the importable state instead of hanging on the progress bar.
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Import ZIP' })).toBeVisible()
})

test('ZIP without activities.csv is rejected with a descriptive message', async ({
  page,
}, testInfo) => {
  // Build a real ZIP that simply lacks the CSV — different failure mode from
  // a corrupt archive (JSZip succeeds, our own validation must catch it).
  const { default: JSZip } = await import('jszip')
  const { writeFileSync, mkdirSync } = await import('fs')
  const { join } = await import('path')
  const zip = new JSZip()
  zip.file('profile.json', '{}')
  const buffer = Buffer.from(await zip.generateAsync({ type: 'arraybuffer' }))
  const dir = workerTmpDir(testInfo.parallelIndex)
  mkdirSync(dir, { recursive: true })
  const zipPath = join(dir, 'no-csv.zip')
  writeFileSync(zipPath, buffer)

  await page.goto('/')
  await page.setInputFiles('[data-testid="zip-input"]', zipPath)

  await expect(page.getByRole('alert')).toContainText('activities.csv', { timeout: 15_000 })
})
