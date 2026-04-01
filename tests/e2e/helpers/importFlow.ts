// ─── Shared import flow ───────────────────────────────────────────────────────
//
// Most specs need "a browser with the fixture imported" as their starting
// state. One helper, one canonical way to reach it — specs diverge only after
// the dashboard is visible.

import { expect, type Page } from '@playwright/test'
import { tmpdir } from 'os'
import { join } from 'path'
import { createFixtureZipFile } from './fixtureZip'
import type { FixtureZipOptions } from '../../fixtures/buildZip'

/** Per-worker temp dir — workers run in parallel and must not share files. */
export function workerTmpDir(parallelIndex: number): string {
  return join(tmpdir(), `strava-e2e-${String(parallelIndex)}`)
}

/** Navigate to onboarding, upload a fixture ZIP, wait until the app shell appears. */
export async function importFixture(
  page: Page,
  parallelIndex: number,
  options: FixtureZipOptions = {},
): Promise<void> {
  const zipPath = await createFixtureZipFile(workerTmpDir(parallelIndex), options)

  await page.goto('/')
  await expect(page.getByText('Connect your Strava data')).toBeVisible()
  await page.setInputFiles('[data-testid="zip-input"]', zipPath)

  // Import worker parses CSV + stores blobs — generous timeout for CI boxes.
  await expect(page.getByText('Connect your Strava data')).not.toBeVisible({ timeout: 30_000 })
}
