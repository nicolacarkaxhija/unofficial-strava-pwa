// ─── Dashboard E2E ────────────────────────────────────────────────────────────
//
// Weekly stat tiles + deltas + recent activities, against the real fixture.
// The fixture spreads 60 activities over 90 days ending yesterday, so the
// previous ISO week is always fully populated and every tile has a delta badge
// (the current week's content varies with the day the suite runs — tests
// assert presence and format, not exact values).

import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFlow'

test.beforeEach(async ({ page }, testInfo) => {
  await importFixture(page, testInfo.parallelIndex)
})

test('shows four week-at-a-glance tiles with delta badges', async ({ page }) => {
  await expect(page.getByTestId('week-stats')).toBeVisible()

  for (const key of ['distance', 'time', 'elevation', 'activities']) {
    const tile = page.getByTestId(`week-stat-${key}`)
    await expect(tile).toBeVisible()
    // Every tile carries a week-over-week badge (▲/▼/·).
    await expect(tile.getByTestId('week-delta')).toBeVisible()
  }

  // Distance tile renders in the default metric units.
  await expect(page.getByTestId('week-stat-distance')).toContainText('km')
})

test('lists the five most recent activities with sport metadata', async ({ page }) => {
  const recent = page.getByTestId('recent-activities')
  await expect(recent).toBeVisible()
  await expect(recent.locator('li')).toHaveCount(5)
  // Fixture names are "<Sport> #<n>" — the newest activity is #1.
  await expect(recent.locator('li').first()).toContainText('#1')
})

test('recent list links through to the Activities page', async ({ page }) => {
  await page
    .getByRole('link', { name: /Activities/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible()
  await expect(page.getByTestId('activity-item').first()).toBeVisible()
})
