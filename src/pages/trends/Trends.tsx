import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeltaBadge, LoadingSkeleton } from '@/components/ui'
import { WeeklyBarChart } from '@/components/charts/WeeklyBarChart'
import { useAllActivities } from '@/db/hooks'
import { computeWeeklyTotals, computeRecords, rollingFourWeek, sportTypes } from '@/lib/aggregates'
import { useUnits } from '@/lib/useUnits'
import { formatDistance, formatDuration, formatElevation } from '@/lib/units'
import type { PersonalRecord } from '@/lib/aggregates'

// ─── Trends ───────────────────────────────────────────────────────────────────
//
// Weekly volume bar chart (distance/time/elevation, switchable) per sport,
// plus personal records for the selected sport.
//
// Sport selection drives BOTH sections: comparing a Ride week to a Run week is
// meaningless (10 km of each are entirely different efforts), so the chart and
// records always share one sport context instead of a per-section toggle.

type Metric = 'distanceKm' | 'movingTimeSec' | 'elevationGainM'

const METRICS: { key: Metric; labelKey: string }[] = [
  { key: 'distanceKm', labelKey: 'metric.distance' },
  { key: 'movingTimeSec', labelKey: 'metric.time' },
  { key: 'elevationGainM', labelKey: 'metric.elevation' },
]

export default function Trends() {
  const { t } = useTranslation('trends')
  const { units } = useUnits()
  const [metric, setMetric] = useState<Metric>('distanceKm')
  // null until data loads, then defaults to the most frequent sport.
  const [sport, setSport] = useState<string | null>(null)

  const activities = useAllActivities()

  // All four aggregates walk the FULL activities array; memoized above the
  // early returns (rules of hooks) so switching metric only recomputes the
  // rolling comparison and a plain re-render recomputes nothing.
  const types = useMemo(() => (activities === undefined ? [] : sportTypes(activities)), [activities])
  const activeSport = sport ?? types.at(0) ?? null
  const buckets = useMemo(
    () =>
      activities === undefined || activeSport === null
        ? []
        : computeWeeklyTotals(activities.filter((a) => a.type === activeSport)),
    [activities, activeSport],
  )
  const records = useMemo(
    () =>
      activities === undefined || activeSport === null
        ? null
        : computeRecords(activities, activeSport),
    [activities, activeSport],
  )
  const rolling = useMemo(
    () =>
      activities === undefined || activeSport === null
        ? null
        : rollingFourWeek(activities, metric, activeSport),
    [activities, metric, activeSport],
  )

  if (activities === undefined) {
    return (
      <div className="px-4 pt-8 pb-6">
        <LoadingSkeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  // records === null exactly when activeSport === null; the extra check just
  // narrows the type for the render below.
  if (activeSport === null || records === null) {
    return (
      <div className="px-4 pt-8 pb-6">
        <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
      </div>
    )
  }

  const formatMetric = (value: number): string =>
    metric === 'distanceKm'
      ? formatDistance(value, units)
      : metric === 'movingTimeSec'
        ? formatDuration(value)
        : formatElevation(value, units)

  return (
    <div className="px-4 pt-8 pb-6">
      <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>

      {/* Sport switcher */}
      <div
        className="mb-4 flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label={t('sportFilterLabel')}
        data-testid="trend-sports"
      >
        {types.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={type === activeSport}
            onClick={() => {
              setSport(type)
            }}
            className={`min-h-11 shrink-0 rounded-full px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
              type === activeSport
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Rolling 4-week comparison — anchored to the newest activity, not
          today (see rollingFourWeek), so a stale export still compares its
          final month against the month before. */}
      {rolling && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800"
          data-testid="rolling-four-week"
        >
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">
              {t('rolling.title')}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {formatMetric(rolling.current)}
            </p>
          </div>
          <DeltaBadge
            delta={rolling.delta}
            format={(n) => formatMetric(Math.abs(n))}
            title={t('rolling.vsPrevious')}
            testId="rolling-delta"
          />
        </div>
      )}

      {/* Weekly volume chart with metric switcher */}
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
        <p className="mb-2 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">
          {t('weeklyVolume')}
        </p>
        <div
          className="mb-3 flex gap-2"
          role="group"
          aria-label={t('metricSwitcherLabel')}
          data-testid="trend-metrics"
        >
          {METRICS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => {
                setMetric(key)
              }}
              className={`min-h-11 flex-1 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                metric === key
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <WeeklyBarChart
          buckets={buckets}
          metric={metric}
          formatValue={formatMetric}
          // Data-bearing label: metric name, span and peak give a screen-reader
          // user the chart's headline without needing per-bar navigation.
          ariaLabel={t('chartLabel', {
            metric: t(METRICS.find((m) => m.key === metric)?.labelKey ?? 'metric.distance'),
            weeks: buckets.length,
            peak: formatMetric(Math.max(...buckets.map((b) => b[metric]), 0)),
          })}
        />
      </div>

      {/* Personal records for the selected sport */}
      <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
        <p className="mb-3 text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">
          {t('records.title')}
        </p>
        <ul className="space-y-3" data-testid="records-list">
          <RecordRow
            label={t('records.longestDistance')}
            record={records.longestDistanceKm}
            format={(v) => formatDistance(v, units)}
          />
          <RecordRow
            label={t('records.longestDuration')}
            record={records.longestDurationSec}
            format={formatDuration}
          />
          <RecordRow
            label={t('records.mostElevation')}
            record={records.mostElevationM}
            format={(v) => formatElevation(v, units)}
          />
        </ul>
      </div>
    </div>
  )
}

function RecordRow({
  label,
  record,
  format,
}: {
  label: string
  record: PersonalRecord | null
  format: (value: number) => string
}) {
  return (
    <li className="flex items-center justify-between gap-3" data-testid="record-row">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
        {record && (
          <p className="truncate text-xs text-slate-400 dark:text-slate-500">
            {record.name || '—'}
            {' · '}
            {new Date(record.date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        )}
      </div>
      <span className="shrink-0 text-lg font-bold text-slate-900 dark:text-white">
        {record ? format(record.value) : '—'}
      </span>
    </li>
  )
}
