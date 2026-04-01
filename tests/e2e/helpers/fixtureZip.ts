// ─── E2E Fixture ZIP Helper ───────────────────────────────────────────────────
//
// Playwright tests run in two contexts: the Node.js test runner (where this
// helper executes) and the real Chromium browser (where the app lives).
//
// buildFixtureZip() produces a Blob — we write its bytes to a temp file on
// disk. Playwright's page.setInputFiles() then reads that file and delivers it
// to the browser as if the user had selected it via a native file picker.
//
// This avoids any need to mock fetch, IndexedDB, or the import worker.

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { buildFixtureZip, type FixtureZipOptions } from '../../fixtures/buildZip'

/**
 * Build a fixture ZIP and write it to a temp file. Returns the absolute path
 * so callers can pass it to `page.setInputFiles()`.
 *
 * Callers derive tmpDir from the worker's parallelIndex to avoid file-system
 * races between parallel Playwright workers.
 */
export async function createFixtureZipFile(
  tmpDir: string,
  options: FixtureZipOptions = {},
): Promise<string> {
  // Ensure the dir exists — Playwright doesn't guarantee it pre-exists.
  mkdirSync(tmpDir, { recursive: true })

  const blob = await buildFixtureZip(options)

  // Blob → ArrayBuffer → Buffer is the only Node.js-safe conversion path.
  const buffer = Buffer.from(await blob.arrayBuffer())

  const filePath = join(tmpDir, 'fixture.zip')
  writeFileSync(filePath, buffer)

  return filePath
}

/** Write a deliberately corrupt "ZIP" for error-path tests. */
export function createCorruptZipFile(tmpDir: string): string {
  mkdirSync(tmpDir, { recursive: true })
  const filePath = join(tmpDir, 'corrupt.zip')
  writeFileSync(filePath, Buffer.from('this is not a zip archive at all'))
  return filePath
}
