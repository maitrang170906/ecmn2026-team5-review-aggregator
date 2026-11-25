import PropTypes from 'prop-types'
import { SOURCES, sourceStyle } from './sources'

// Average rating per platform, as a horizontal bar chart (bar length = avg / 5).
// Pure CSS bars: no chart library needed for 3 values.
export default function SourceBreakdown({ perSource }) {
  const rows = SOURCES.map((s) => ({ ...s, ...(perSource?.[s.name] || { avg: null, count: 0 }) }))
  // Simple insight for managers: which platform rates the product best / worst
  const rated = rows.filter((r) => r.avg !== null).sort((a, b) => b.avg - a.avg)
  const best = rated[0]
  const worst = rated[rated.length - 1]
  const gap = best && worst ? best.avg - worst.avg : 0

  return (
    <section className="bg-white rounded-lg border p-4" aria-labelledby="source-breakdown-heading">
      <h3 id="source-breakdown-heading" className="font-semibold text-gray-900 mb-3">Rating by source</h3>
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr><th>Source</th><th>Average rating</th><th>Reviews</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row" className="py-1.5 pr-3 text-left font-medium text-gray-700 w-20">{r.name}</th>
              <td className="py-1.5 pr-3 w-full">
                <div className="h-4 bg-gray-100 rounded" aria-hidden="true">
                  <div
                    className={`h-4 rounded ${sourceStyle(r.name).bar} transition-all`}
                    style={{ width: `${r.avg ? (r.avg / 5) * 100 : 0}%` }}
                  />
                </div>
              </td>
              <td className="py-1.5 text-right whitespace-nowrap tabular-nums text-gray-700">
                {r.avg !== null ? <><strong>{r.avg.toFixed(2)}</strong> / 5</> : '—'}
                <span className="text-gray-400 ml-2">({r.count})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rated.length > 1 && (
        <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded p-3">
          Best rated on <strong>{best.name}</strong> ({best.avg.toFixed(2)}), lowest on{' '}
          <strong>{worst.name}</strong> ({worst.avg.toFixed(2)}).{' '}
          {gap >= 0.5
            ? 'The gap is large: check what customers on the lowest platform complain about.'
            : 'Ratings are consistent across platforms.'}
        </p>
      )}
    </section>
  )
}

SourceBreakdown.propTypes = {
  perSource: PropTypes.objectOf(PropTypes.shape({ avg: PropTypes.number, count: PropTypes.number })),
}
