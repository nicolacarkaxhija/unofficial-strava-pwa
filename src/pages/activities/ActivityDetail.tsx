import { Link, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ElevationProfile } from '@/components/charts/ElevationProfile'
import { HeartRateChart } from '@/components/charts/HeartRateChart'
import { RouteMap } from '@/components/charts/RouteMap'
import { LoadingSkeleton, NoDataState, SportIcon } from '@/components/ui'
import { useActivity, useRawFile } from '@/db/hooks'
import { useParsedTrack } from '@/lib/useParsedTrack'
import { useUnits } from '@/lib/useUnits'
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPaceOrSpeed,
  usesPace,
} from '@/lib/units'
import type { ReactElement } from 'react'
import type { Activity } from '@/db/schema'
import type { TrackParseResult } from '@/connectors/strava/trackParser'
import type { Units } from '@/lib/units'

// ─── ActivityDetail ───────────────────────────────────────────────────────────
//
// Per-activity page: summary stats from the CSV row, plus (when the export
// shipped a parseable raw file) a tile-free route map, elevation profile and
// heart-rate chart parsed lazily from the stored blob.
//
// Three-state rendering follows the hook contract:
//   activity === undefined → query in flight → skeletons
//   activity === null      → unknown id       → resolved NoDataState (never an
//                            eternal skeleton — that exact trap shipped as a
//                            bug in the sibling template)
//   otherwise              → render; the track section has its own async
//                            skeleton because parsing starts only after the
//                            blob row arrives.

export default function ActivityDetail() {
  const { units } = useUnits()

  // Route-level validation guarantees id is a non-empty string; existence in
  // the DB is this hook's job (null = resolved not-found).
  const { id } = useParams({ from: '/activities/$id' })

  const activity = useActivity(id)
  // rawFile stays undefined until the activity row (and its fileRef) resolves.
  const rawFile = useRawFile(activity?.fileRef ?? null)
  const parsed = useParsedTrack(activity === undefined ? undefined : rawFile)

  if (activity === undefined) {
    return (
      <div className="space-y-4 px-4 pt-8 pb-6">
        <LoadingSkeleton className="h-6 w-24 rounded-lg" />
        <LoadingSkeleton className="h-8 w-56 rounded-lg" />
        <LoadingSkeleton className="h-40 w-full rounded-2xl" />
        <LoadingSkeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (activity === null) {
    return <NoDataState />
  }

  return (
    <div className="space-y-6 px-4 pt-8 pb-6" data-testid="activity-detail">
      <BackLink />

      {/* Header: sport icon + name + type/date */}
      <div className="flex items-center gap-3">
        <SportIcon type={activity.type} className="shrink-0 text-orange-500 dark:text-orange-400" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900 dark:text-white">
            {activity.name || activity.type}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {activity.type}
            {' · '}
            {new Date(activity.date).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <StatGrid activity={activity} units={units} />

      {/* Track section only exists when the CSV referenced a raw file at all;
          a manual activity (fileRef null) shows stats only, no note. */}
      {activity.fileRef !== null && (
        <TrackSection activity={activity} parsed={parsed} units={units} />
      )}
    </div>
  )
}

// ─── Stats grid ───────────────────────────────────────────────────────────────

function StatGrid({ activity, units }: { activity: Activity; units: Units }) {
  const { t } = useTranslation('activities')

  // Build the list conditionally — a null field is omitted entirely rather
  // than rendered as "—": on a detail page an em-dash row is dead weight,
  // unlike the list where column alignment matters.
  const stats: Array<{ key: string; label: string; value: string }> = []
  const push = (key: string, label: string, value: string) => stats.push({ key, label, value })

  if (activity.distanceKm !== null)
    push('distance', t('detail.stats.distance'), formatDistance(activity.distanceKm, units))
  if (activity.movingTimeSec !== null)
    push('movingTime', t('detail.stats.movingTime'), formatDuration(activity.movingTimeSec))
  if (activity.elapsedTimeSec !== null)
    push('elapsedTime', t('detail.stats.elapsedTime'), formatDuration(activity.elapsedTimeSec))
  if (activity.distanceKm !== null && activity.movingTimeSec !== null)
    push(
      'paceOrSpeed',
      usesPace(activity.type) ? t('detail.stats.pace') : t('detail.stats.speed'),
      formatPaceOrSpeed(activity.type, activity.distanceKm, activity.movingTimeSec, units),
    )
  if (activity.elevationGainM !== null)
    push(
      'elevationGain',
      t('detail.stats.elevationGain'),
      formatElevation(activity.elevationGainM, units),
    )
  if (activity.avgHeartRate !== null)
    push('avgHr', t('detail.stats.avgHr'), `${String(Math.round(activity.avgHeartRate))} bpm`)
  if (activity.maxHeartRate !== null)
    push('maxHr', t('detail.stats.maxHr'), `${String(Math.round(activity.maxHeartRate))} bpm`)
  if (activity.calories !== null)
    push('calories', t('detail.stats.calories'), String(Math.round(activity.calories)))
  if (activity.avgWatts !== null)
    push('avgWatts', t('detail.stats.avgWatts'), `${String(Math.round(activity.avgWatts))} W`)

  return (
    <section
      className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800"
      data-testid="stat-grid"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.key} data-testid="stat-item">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{s.label}</dt>
            <dd className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ─── Track section ────────────────────────────────────────────────────────────

function TrackSection({
  activity,
  parsed,
  units,
}: {
  activity: Activity
  parsed: TrackParseResult | null | undefined
  units: Units
}) {
  const { t } = useTranslation('activities')

  // undefined → blob row loading or parse running → skeleton (a real parse of
  // a big TCX takes a beat; a blank gap would read as "no track").
  if (parsed === undefined) {
    return <LoadingSkeleton className="h-60 w-full rounded-2xl" />
  }

  // null → the CSV referenced a file the ZIP didn't contain (tolerated at
  // import). Resolved absence: render nothing rather than an error the user
  // can't act on.
  if (parsed === null) return null

  if (parsed.kind !== 'track') {
    const noteKey =
      parsed.kind === 'unsupported-fit'
        ? 'detail.fitNotSupported'
        : parsed.kind === 'unsupported-gz'
          ? 'detail.gzNotSupported'
          : parsed.kind === 'empty'
            ? 'detail.trackEmpty'
            : 'detail.trackError' // 'error' and 'unsupported-format'
    return (
      <p
        className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        data-testid="track-note"
        data-note-kind={parsed.kind}
      >
        {t(noteKey)}
      </p>
    )
  }

  const { track } = parsed
  const hasHr = track.points.some((p) => p.hr !== undefined)

  return (
    <>
      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {t('detail.route')}
        </h2>
        <RouteMap
          points={track.points}
          // Prefer the CSV's official distance in the label; fall back to the
          // track-derived total for files whose CSV row lacked one.
          distanceLabel={formatDistance(activity.distanceKm ?? track.totalDistanceKm, units)}
        />
      </section>

      {/* ElevationProfile / HeartRateChart return null themselves when the
          data can't support a chart (<2 ele points, no hr) — sections wrap
          them only when worth rendering to avoid empty white cards. */}
      {track.points.filter((p) => p.ele !== undefined).length >= 2 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('detail.elevationProfile')}
          </h2>
          <ElevationProfile
            track={track}
            formatElevation={(m) => formatElevation(m, units)}
            formatDistance={(km) => formatDistance(km, units)}
          />
        </section>
      )}

      {hasHr && (
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('detail.heartRate')}
          </h2>
          <HeartRateChart points={track.points} formatDuration={(s) => formatDuration(s)} />
        </section>
      )}
    </>
  )
}

// ─── Back link ────────────────────────────────────────────────────────────────

function BackLink(): ReactElement {
  const { t } = useTranslation('common')
  return (
    <Link
      to="/activities"
      className="inline-flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400"
      data-testid="back-link"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M10 4l-4 4 4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {t('back')}
    </Link>
  )
}
