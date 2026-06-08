// ─── Trends E2E ───────────────────────────────────────────────────────────────
//
// Weekly volume SVG bar chart (metric + sport switchable) and personal records.

import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFlow'

test.beforeEach(async ({ page }, testInfo) => {
  await importFixture(page, testInfo.parallelIndex)
  await page.goto('/trends')
  await expect(page.getByRole('heading', { name: 'Trends' })).toBeVisible()
})

test('renders the weekly bar chart with one bar per ISO week', async ({ page }) => {
  await expect(page.getByTestId('weekly-bar-chart')).toBeVisible()

  // 90 days ≈ 13–14 ISO weeks; the chart draws a bar per week (zero weeks
  // included). Assert a sane band rather than an exact count — the span
  // depends on where "yesterday" falls in the week.
  const bars = page.getByTestId('weekly-bar')
  const count = await bars.count()
  expect(count).toBeGreaterThanOrEqual(12)
  expect(count).toBeLessThanOrEqual(15)
})

test('metric switcher toggles distance/time/elevation', async ({ page }) => {
  const metrics = page.getByTestId('trend-metrics')
  await expect(metrics.getByRole('button', { name: 'Distance' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await metrics.getByRole('button', { name: 'Time' }).click()
  await expect(metrics.getByRole('button', { name: 'Time' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('weekly-bar-chart')).toBeVisible()

  await metrics.getByRole('button', { name: 'Elevation' }).click()
  await expect(page.getByTestId('weekly-bar-chart')).toBeVisible()
})

test('sport switcher changes the chart and records context', async ({ page }) => {
  const sports = page.getByTestId('trend-sports')
  // Fixture sports all have 15 activities; the default is whichever sorts
  // first by frequency — switch explicitly to Ride.
  await sports.getByRole('button', { name: 'Ride', exact: true }).click()
  await expect(sports.getByRole('button', { name: 'Ride', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Records list shows the three per-sport bests, with the record activity's name.
  const records = page.getByTestId('records-list')
  await expect(records.getByTestId('record-row')).toHaveCount(3)
  await expect(records).toContainText('Ride #')
})

test('personal records show longest distance, duration and elevation', async ({ page }) => {
  const records = page.getByTestId('records-list')
  await expect(records).toContainText('Longest distance')
  await expect(records).toContainText('Longest duration')
  await expect(records).toContainText('Most elevation')
  // Distance record renders a value in the active units.
  await expect(records).toContainText('km')
})

test('rolling 4-week row shows the current total with a delta badge', async ({ page }) => {
  // Fixture spans 90 days ending yesterday, so both 28-day windows have data.
  const row = page.getByTestId('rolling-four-week')
  await expect(row).toBeVisible()
  await expect(row).toContainText('Last 4 weeks')
  await expect(row.getByTestId('rolling-delta')).toBeVisible()
})
