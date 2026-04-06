// One-off generator: writes a synthetic Strava export ZIP for manual testing
// of the live app. Run: npx tsx scripts/gen-fixture-zip.mts [outDir]
import { createFixtureZipFile } from '../tests/e2e/helpers/fixtureZip'

const outDir = process.argv[2] ?? '.'
// 150 activities over ~6 months gives every range-selector window, several
// sports, and enough ISO weeks for meaningful trends.
const path = await createFixtureZipFile(outDir, { activities: 150, spanDays: 180, gpxFiles: 10 })
console.log('written:', path)
