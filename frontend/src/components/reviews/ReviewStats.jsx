import PropTypes from 'prop-types'

// 1–5 star histogram + weekly trend timeline (average rating per week).
export default function ReviewStats({ histogram, timeline, count }) {
  const total = count || 0
  const maxWeekCount = Math.max(1, ...(timeline || []).map((w) => w.count))

  return (
    <section className="bg-white rounded-lg border p-4" aria-labelledby="stats-heading">
      <h3 id="stats-heading" className="font-semibold text-gray-900 mb-3">Rating distribution</h3>
      <ul className="space-y-1.5 text-sm">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = histogram?.[star] ?? 0
          const pct = total ? Math.round((n / total) * 100) : 0
          return (
            <li key={star} className="flex items-center gap-3">
              <span className="w-10 text-gray-700 whitespace-nowrap">{star} ★</span>
              <div className="flex-1 h-4 bg-gray-100 rounded" aria-hidden="true">
                <div className="h-4 bg-amber-400 rounded transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-20 text-right tabular-nums text-gray-600">
                {n} <span className="text-gray-400">({pct}%)</span>
              </span>
            </li>
          )
        })}
      </ul>

      {timeline && timeline.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Trend by week (average rating)</h4>
          <ol className="flex items-end gap-2 h-28 border-b border-gray-200" aria-label="Average rating per week">
            {timeline.map((w) => (
              <li key={w.week} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs font-medium text-gray-700 tabular-nums">{w.avg.toFixed(1)}</span>
                <div
                  className="w-full max-w-10 bg-emerald-500 rounded-t"
                  style={{ height: `${(w.avg / 5) * 80}%` }}
                  title={`${w.count} review(s)`}
                  aria-hidden="true"
                />
              </li>
            ))}
          </ol>
          <ol className="flex gap-2 mt-1" aria-hidden="true">
            {timeline.map((w) => (
              <li key={w.week} className="flex-1 text-center text-[11px] text-gray-500 leading-tight">
                {new Date(`${w.week}T00:00:00Z`).toLocaleDateString(undefined, { day: '2-digit', month: 'short', timeZone: 'UTC' })}
                <br />
                <span className="text-gray-400" style={{ opacity: 0.4 + 0.6 * (w.count / maxWeekCount) }}>{w.count} rev.</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

ReviewStats.propTypes = {
  histogram: PropTypes.objectOf(PropTypes.number),
  timeline: PropTypes.arrayOf(PropTypes.shape({ week: PropTypes.string, avg: PropTypes.number, count: PropTypes.number })),
  count: PropTypes.number,
}
