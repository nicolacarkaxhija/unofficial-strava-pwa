// ─── Activity detail E2E ──────────────────────────────────────────────────────
//
// The fixture assigns raw files to activities sequentially (newest first):
//   i=0 Run #1   → .gpx     (real Milan loop, WITH gpxtpx:hr)
//   i=1 Ride #2  → .gpx     (no HR)
//   i=2 Walk #3  → .tcx     (with HR)
//   i=3 Swim #4  → .gpx.gz  (gzipped)
//   i=4 Run #5   → .fit     (real binary FIT, with HR)
//   i≥5          → no file  (stats-only path)
// Ids are deterministic (`9${100000000+i}`), so direct-URL tests can address
// any of these without scraping the list first.

import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFlow'

const FILE_OPTIONS = { gpxFiles: 2, tcxFiles: 1, gzGpxFiles: 1, fitFiles: 1 }

const id = (i: number) => `9${String(100000000 + i)}`

test.beforeEach(async ({ page }, testInfo) => {
  await importFixture(page, testInfo.parallelIndex, FILE_OPTIONS)
})

test('clicking a list row opens the detail page with the stat grid', async ({ page }) => {
  await page.goto('/activities')
  // "Run #1" is a substring of "Run #13" — address the row by its href.
  await page.locator(`[data-testid="activity-item"][href="/activities/${id(0)}"]`).click()

  await expect(page.getByTestId('activity-detail')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Run #1' })).toBeVisible()

  const grid = page.getByTestId('stat-grid')
  await expect(grid).toBeVisible()
  await expect(grid).toContainText('Distance')
  await expect(grid).toContainText('Moving time')
  // Run → pace convention, end to end.
  await expect(grid).toContainText('/km')
})

test('a GPX activity shows route map, elevation profile and HR chart', async ({ page }) => {
  // Run #1 carries the gpxtpx:hr extension — all three charts must appear.
  await page.goto(`/activities/${id(0)}`)

  await expect(page.getByTestId('route-map')).toBeVisible()
  await expect(page.getByTestId('route-start')).toBeVisible()
  await expect(page.getByTestId('route-end')).toBeVisible()
  await expect(page.getByTestId('elevation-profile')).toBeVisible()
  await expect(page.getByTestId('hr-chart')).toBeVisible()
})

test('a GPX without HR extensions skips the HR chart silently', async ({ page }) => {
  await page.goto(`/activities/${id(1)}`)

  await expect(page.getByTestId('route-map')).toBeVisible()
  await expect(page.getByTestId('elevation-profile')).toBeVisible()
  await expect(page.getByTestId('hr-chart')).toHaveCount(0)
  await expect(page.getByTestId('track-note')).toHaveCount(0)
})

test('a TCX activity parses to the same charts, HR included', async ({ page }) => {
  await page.goto(`/activities/${id(2)}`)

  await expect(page.getByTestId('route-map')).toBeVisible()
  await expect(page.getByTestId('hr-chart')).toBeVisible()
})

test('a gzipped GPX decompresses in the browser and renders the route', async ({ page }) => {
  await page.goto(`/activities/${id(3)}`)

  await expect(page.getByTestId('route-map')).toBeVisible()
})

test('a FIT activity decodes in the browser and renders route and HR chart', async ({ page }) => {
  await page.goto(`/activities/${id(4)}`)

  await expect(page.getByTestId('route-map')).toBeVisible()
  await expect(page.getByTestId('hr-chart')).toBeVisible()
  await expect(page.getByTestId('track-note')).toHaveCount(0)
})

test('an activity without a raw file shows stats only — no charts, no note', async ({ page }) => {
  await page.goto(`/activities/${id(10)}`)

  await expect(page.getByTestId('stat-grid')).toBeVisible()
  await expect(page.getByTestId('route-map')).toHaveCount(0)
  await expect(page.getByTestId('track-note')).toHaveCount(0)
})

test('an unknown id resolves to the no-data state, not eternal skeletons', async ({ page }) => {
  await page.goto('/activities/does-not-exist')

  await expect(page.getByTestId('no-data-state')).toBeVisible()
  // The way back leads to the list.
  await page.getByTestId('no-data-state').getByRole('link').click()
  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible()
})

test('the back link returns to the activities list', async ({ page }) => {
  await page.goto(`/activities/${id(0)}`)
  await expect(page.getByTestId('activity-detail')).toBeVisible()

  await page.getByTestId('back-link').click()
  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible()
})
