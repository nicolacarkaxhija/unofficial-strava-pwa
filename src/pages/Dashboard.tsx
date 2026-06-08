import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { DeltaBadge, LoadingSkeleton, SportIcon } from '@/components/ui'
import { useAllActivities } from '@/db/hooks'
import { computeWeekAtAGlance } from '@/lib/aggregates'
import { useUnits } from '@/lib/useUnits'
import { formatDistance, formatDuration, formatElevation, formatPaceOrSpeed } from '@/lib/units'
import type { Activity } from '@/db/schema'
import type { Units } from '@/lib/units'

// ─── Dashboard ────────────────────────────────────────────────────────────────
//
// "This week at a glance": distance, time, elevation gain and activity count
// for the current ISO week, each with a week-over-week delta badge, plus the
// five most recent activities.
//
// Why calendar ISO weeks rather than latest-7-rows: training volume is planned
// and discussed in calendar weeks (Strava's own weekly stats work this way);
// a Monday reset is the mental model. An empty current week showing zeros is
// honest, not a bug.
//
// Loading state: useAllActivities() returning undefined means IndexedDB hasn't
// responded yet — show skeleton tiles to avoid layout shift when data arrives.

export default function Dashboard() {
  const { t } = useTranslation('common')
  const { t: tActivities } = useTranslation('activities')
  const { units } = useUnits()

  const activities = useAllActivities()

  if (activities === undefined) {
    return (
      <div className="px-4 pt-8 pb-6">
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <LoadingSkeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const glance = computeWeekAtAGlance(activities)
  const recent = activities.slice(0, 5)

  // Each tile formats its own value/delta pair with the same formatter so the
  // delta always reads in the tile's unit.
  const tiles: { key: string; value: string; delta: number; fmt: (n: number) => string }[] = [
    {
      key: 'distance',
      value: formatDistance(glance.current.distanceKm, units),
      delta: glance.delta.distanceKm,
      fmt: (n) => formatDistance(Math.abs(n), units),
    },
    {
      key: 'time',
      value: formatDuration(glance.current.movingTimeSec),
      delta: glance.delta.movingTimeSec,
      fmt: (n) => formatDuration(Math.abs(n)),
    },
    {
      key: 'elevation',
      value: formatElevation(glance.current.elevationGainM, units),
      delta: glance.delta.elevationGainM,
      fmt: (n) => formatElevation(Math.abs(n), units),
    },
    {
      key: 'activities',
      value: String(glance.current.count),
      delta: glance.delta.count,
      fmt: (n) => String(Math.abs(n)),
    },
  ]

  return (
    <div className="px-4 pt-8 pb-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">
        {t('week.thisWeek')}
      </h1>

      <div className="grid grid-cols-2 gap-4" data-testid="week-stats">
        {tiles.map(({ key, value, delta, fmt }) => (
          <div
            key={key}
            className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800"
            data-testid={`week-stat-${key}`}
          >
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {t(`week.${key}`)}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <DeltaBadge delta={delta} format={fmt} title={t('week.vsPrevWeek')} testId="week-delta" />
          </div>
        ))}
      </div>

      {/* ── Recent activities ── the five newest rows, linking to the full list */}
      {recent.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
            {tActivities('recent')}
          </h2>
          <ul className="space-y-2" data-testid="recent-activities">
            {recent.map((a) => (
              <li key={a.id}>
                <ActivityRow activity={a} units={units} />
              </li>
            ))}
          </ul>
          <Link
            to="/activities"
            className="mt-3 block text-center text-sm font-medium text-orange-600 dark:text-orange-400"
          >
            {tActivities('title')} →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── ActivityRow ──────────────────────────────────────────────────────────────
//
// Kept private to Dashboard: the Activities page has its own richer row.
// No detail page exists in v1, so rows are static (not links).

function ActivityRow({ activity, units }: { activity: Activity; units: Units }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-800">
      <SportIcon type={activity.type} className="shrink-0 text-orange-500 dark:text-orange-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {activity.name || activity.type}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(activity.date).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
          {' · '}
          {formatDistance(activity.distanceKm, units)}
          {' · '}
          {formatPaceOrSpeed(activity.type, activity.distanceKm, activity.movingTimeSec, units)}
        </p>
      </div>
    </div>
  )
}
