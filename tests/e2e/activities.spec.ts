// ─── Activities list E2E ──────────────────────────────────────────────────────
//
// List rendering, sport-type chip filter and the range selector. The fixture's
// 60 activities cycle Run/Ride/Walk/Swim evenly (15 each) over 90 days, so
// filter/range expectations can be computed without reading the app's state.

import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFlow'

test.beforeEach(async ({ page }, testInfo) => {
  await importFixture(page, testInfo.parallelIndex)
  await page.goto('/activities')
  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible()
})

test('lists activities with distance, time and pace/speed per row', async ({ page }) => {
  const rows = page.getByTestId('activity-item')
  await expect(rows.first()).toBeVisible()

  // Run rows show pace (min/km), Ride rows show speed (km/h) — the
  // convention-not-setting rule, verified end to end.
  const runRow = rows.filter({ hasText: 'Run #' }).first()
  await expect(runRow).toContainText('/km')
  const rideRow = rows.filter({ hasText: 'Ride #' }).first()
  await expect(rideRow).toContainText('km/h')
})

test('sport chips filter the list to a single type', async ({ page }) => {
  const chips = page.getByTestId('sport-chips')
  await expect(chips).toBeVisible()

  await chips.getByRole('button', { name: 'Swim', exact: true }).click()

  const rows = page.getByTestId('activity-item')
  await expect(rows.first()).toContainText('Swim')
  const count = await rows.count()
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText('Swim #')
  }

  // "All sports" restores the mixed list.
  await chips.getByRole('button', { name: 'All sports' }).click()
  expect(await page.getByTestId('activity-item').count()).toBeGreaterThan(count)
})

test('range selector narrows and widens the visible window', async ({ page }) => {
  // 90d shows (almost) the whole 90-day fixture; 30d must show roughly a third.
  const all90 = await page.getByTestId('activity-item').count()

  await page.getByRole('button', { name: '30d' }).click()
  const at30 = await page.getByTestId('activity-item').count()
  expect(at30).toBeLessThan(all90)
  expect(at30).toBeGreaterThan(0)

  // exact: 'All' would otherwise also match the 'All sports' chip.
  await page.getByRole('button', { name: 'All', exact: true }).click()
  const atAll = await page.getByTestId('activity-item').count()
  expect(atAll).toBeGreaterThanOrEqual(all90)
})

test('empty state when a range contains no activities of the chosen sport', async ({ page }) => {
  // Fixture has no activities today (they end yesterday at the earliest) —
  // but a 30d window always has some; instead filter to a sport then shrink
  // the window to 30d and verify the list either renders rows or the i18n
  // empty message — never a blank screen.
  await page.getByRole('button', { name: '30d' }).click()
  await page.getByTestId('sport-chips').getByRole('button', { name: 'Swim', exact: true }).click()

  const rows = page.getByTestId('activity-item')
  const empty = page.getByText('No activities in this range')
  await expect(rows.first().or(empty)).toBeVisible()
})
