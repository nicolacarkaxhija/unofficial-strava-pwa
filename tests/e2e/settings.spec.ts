// ─── Settings E2E ─────────────────────────────────────────────────────────────
//
// Units toggle (persisted, reflected across pages), theme, export JSON,
// clear-all-data flow. Language round-trip lives in i18n.spec.ts.

import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFlow'

test.beforeEach(async ({ page }, testInfo) => {
  await importFixture(page, testInfo.parallelIndex)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})

test('units toggle switches the app to miles and persists across reload', async ({ page }) => {
  await page.getByTestId('units-toggle').getByRole('button', { name: 'Miles' }).click()

  // Dashboard now renders imperial distances.
  await page.goto('/')
  await expect(page.getByTestId('week-stat-distance')).toContainText('mi')

  // Persisted in localStorage — survives a full reload.
  await page.reload()
  await expect(page.getByTestId('week-stat-distance')).toContainText('mi')

  // And pace sports flip to min/mi on the activities list.
  await page.goto('/activities')
  await expect(
    page.getByTestId('activity-item').filter({ hasText: 'Run #' }).first(),
  ).toContainText('/mi')
})

test('theme buttons toggle the dark class on <html> and persist', async ({ page }) => {
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('export JSON downloads a payload with the activities table', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data (JSON)' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/^strava-data-\d{4}-\d{2}-\d{2}\.json$/)

  const path = await download.path()
  const { readFileSync } = await import('fs')
  const payload = JSON.parse(readFileSync(path, 'utf-8')) as {
    format: string
    tables: { activities: unknown[] }
  }
  expect(payload.format).toBe('unofficial-strava-pwa')
  expect(payload.tables.activities).toHaveLength(60)
})

test('clear all data requires confirmation and returns to onboarding', async ({ page }) => {
  await page.getByRole('button', { name: 'Clear all data' }).click()

  // A confirmation prompt must appear before any destructive action.
  await expect(page.getByText('delete all your activity data', { exact: false })).toBeVisible()

  // Cancel first — data must survive.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.goto('/')
  await expect(page.getByTestId('week-stats')).toBeVisible()

  // Now clear for real.
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Clear all data' }).click()
  await page.getByRole('button', { name: 'Clear all data' }).last().click()

  await expect(page.getByText('Connect your Strava data')).toBeVisible({ timeout: 10_000 })
})
