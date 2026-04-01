// ─── Empty states E2E ─────────────────────────────────────────────────────────
//
// With no data imported, the Dashboard route shows onboarding but every other
// tab stays reachable and renders its own empty state — never a blank screen
// or a crash.

import { test, expect } from '@playwright/test'

test('activities page without data shows its empty message', async ({ page }) => {
  await page.goto('/activities')
  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible()
  await expect(page.getByText('No activities in this range')).toBeVisible()
})

test('trends page without data shows its empty message', async ({ page }) => {
  await page.goto('/trends')
  await expect(page.getByRole('heading', { name: 'Trends' })).toBeVisible()
  await expect(page.getByText('Import your Strava export to see trends')).toBeVisible()
})

test('settings page is fully usable without data', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  // Theme and units controls work pre-import.
  await expect(page.getByTestId('units-toggle')).toBeVisible()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: 'Light', exact: true }).click()
})

test('bottom nav navigates between all four tabs without data', async ({ page }) => {
  await page.goto('/activities')
  await page.getByRole('link', { name: 'Trends' }).click()
  await expect(page.getByRole('heading', { name: 'Trends' })).toBeVisible()
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  // Dashboard with no data = onboarding.
  await expect(page.getByText('Connect your Strava data')).toBeVisible()
})
