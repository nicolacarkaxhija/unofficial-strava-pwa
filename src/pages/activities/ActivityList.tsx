import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingSkeleton, RangeSelector, SportIcon } from '@/components/ui'
import { useAllActivities } from '@/db/hooks'
import { sportTypes } from '@/lib/aggregates'
import { useUnits } from '@/lib/useUnits'
import { formatDistance, formatDuration, formatPaceOrSpeed } from '@/lib/units'
import type { Activity } from '@/db/schema'
import type { Units } from '@/lib/units'

// ─── ActivityList ─────────────────────────────────────────────────────────────
//
// Scrollable list of activities, newest first, with two orthogonal filters:
//   • sport-type chips (open set, derived from the data itself)
//   • range selector (30d/90d/1y/All) — calendar days back from today, not a
//     row limit: "last 30 days" is the question athletes actually ask, and a
//     row limit would silently mean different time spans per sport.
//
// Display is additionally paginated with "Show more" so "All" on a decade-long
// export doesn't render thousands of DOM rows at once.
//
// No detail page in v1: a row already shows every field the CSV gives us that
// is worth reading at a glance; a detail view earns its place in phase 2 when
// parsed GPX tracks give it a map to show.

// Rows rendered before a "Show more" click — comfortably above the 1y
// window for a daily athlete so pagination only ever appears for "All".
const PAGE_SIZE = 400

function cutoffIso(rangeDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - rangeDays)
  return d.toISOString()
}

export default function ActivityList() {
  const { t } = useTranslation('activities')
  const { t: tCommon } = useTranslation('common')
  const { units } = useUnits()

  const [rangeDays, setRangeDays] = useState(90)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Returns undefined while IndexedDB is being queried (first render).
  // Filtering happens in JS: even "All" on a large export is a few thousand
  // rows, and chips need the full type census anyway.
  const all = useAllActivities()

  if (all === undefined) {
    return (
      <div className="px-4 pt-8 pb-6">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const types = sportTypes(all)
  const cutoff = cutoffIso(rangeDays)
  const filtered = all.filter(
    (a) => a.date >= cutoff && (typeFilter === null || a.type === typeFilter),
  )

  return (
    <div className="px-4 pt-8 pb-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>

      <RangeSelector
        value={rangeDays}
        onChange={(d) => {
          setRangeDays(d)
          setVisibleCount(PAGE_SIZE)
        }}
      />

      {/* Sport chips — horizontal scroll keeps every sport reachable on narrow
          screens without wrapping into a wall of buttons */}
      {types.length > 0 && (
        <div
          className="mb-4 flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={t('filterAll')}
          data-testid="sport-chips"
        >
          <SportChip
            label={t('filterAll')}
            active={typeFilter === null}
            onClick={() => {
              setTypeFilter(null)
              setVisibleCount(PAGE_SIZE)
            }}
          />
          {types.map((type) => (
            <SportChip
              key={type}
              label={type}
              active={typeFilter === type}
              onClick={() => {
                setTypeFilter(type)
                setVisibleCount(PAGE_SIZE)
              }}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
      ) : (
        <>
          <ul className="space-y-2">
            {filtered.slice(0, visibleCount).map((a) => (
              <li key={a.id}>
                <ActivityRow activity={a} units={units} />
              </li>
            ))}
          </ul>

          {filtered.length > visibleCount && (
            <button
              type="button"
              onClick={() => {
                setVisibleCount((c) => c + PAGE_SIZE)
              }}
              className="mt-4 w-full rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {tCommon('showMore')}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function SportChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}

function ActivityRow({ activity, units }: { activity: Activity; units: Units }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-800"
      data-testid="activity-item"
    >
      <SportIcon type={activity.type} className="shrink-0 text-orange-500 dark:text-orange-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {activity.name || activity.type}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(activity.date).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {formatDistance(activity.distanceKm, units)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatDuration(activity.movingTimeSec)}
          {' · '}
          {formatPaceOrSpeed(activity.type, activity.distanceKm, activity.movingTimeSec, units)}
        </p>
      </div>
    </div>
  )
}
