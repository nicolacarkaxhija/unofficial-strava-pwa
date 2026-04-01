// ─── i18n E2E ─────────────────────────────────────────────────────────────────
//
// EN → IT → EN round trip through the Settings language switcher, plus
// persistence across reload (i18next caches the choice in localStorage).

import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFlow'

test('language round trip EN → IT → EN, persisted across reload', async ({ page }, testInfo) => {
  await importFixture(page, testInfo.parallelIndex)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // Switch to Italian.
  await page.getByRole('button', { name: 'Italiano' }).click()
  await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()

  // Nav and dashboard render in Italian too.
  await page.goto('/')
  await expect(page.getByText('Questa settimana')).toBeVisible()
  // exact: the dashboard's "Attività →" footer link also matches otherwise.
  await expect(page.getByRole('link', { name: 'Attività', exact: true })).toBeVisible()

  // Choice persists across reload.
  await page.reload()
  await expect(page.getByText('Questa settimana')).toBeVisible()

  // Round trip back to English.
  await page.goto('/settings')
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByText('This week')).toBeVisible()
})

test('onboarding renders in Italian when chosen pre-import', async ({ page }) => {
  // Settings is reachable without data — language is useful before importing.
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Italiano' }).click()
  await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()

  await page.goto('/')
  await expect(page.getByText('Connetti i tuoi dati Strava')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importa ZIP' })).toBeVisible()
})
