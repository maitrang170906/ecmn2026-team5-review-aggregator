import PropTypes from 'prop-types'
import StarRating from './StarRating'

// Top of the product page: overall average, total review count and the
// "Fetch Reviews" button (reviews are only fetched when the user asks).
export default function ReviewSummary({ aggregate, loading, fetching, fetchResult, onFetch }) {
  const count = aggregate?.count ?? 0
  const avg = aggregate?.overall_avg
  const lastFetched = aggregate?.last_fetched_at

  return (
    <section className="pt-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-4" aria-labelledby="reviews-heading">
      <div>
        <h2 id="reviews-heading" className="text-xl font-semibold text-gray-900">Customer reviews</h2>
        {loading && !aggregate ? (
          <p className="text-sm text-gray-500 mt-1">Loading statistics…</p>
        ) : count > 0 ? (
          <div className="mt-1 flex items-center gap-3">
            <span className="text-3xl font-bold text-gray-900" aria-label={`Average rating ${avg} out of 5`}>{avg?.toFixed(2)}</span>
            <div>
              <StarRating value={avg} size="text-xl" />
              <div className="text-sm text-gray-600">
                {count} review{count > 1 ? 's' : ''} from {Object.keys(aggregate.per_source).length} source(s)
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 mt-1">No reviews stored yet. Click “Fetch Reviews” to collect them from Amazon, BestBuy and Walmart.</p>
        )}
        {lastFetched && (
          <p className="text-xs text-gray-400 mt-1">
            Last fetched: <time dateTime={lastFetched}>{new Date(lastFetched).toLocaleString()}</time>
          </p>
        )}
      </div>

      <div className="flex flex-col items-start sm:items-end gap-2">
        <button
          type="button"
          onClick={onFetch}
          disabled={fetching}
          className="inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 bg-emerald-600 text-white rounded-md shadow hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50"
          aria-busy={fetching}
        >
          {fetching && <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
          {fetching ? 'Fetching…' : 'Fetch Reviews'}
        </button>
      </div>

      {fetchResult && (
        <p
          role={fetchResult.type === 'error' ? 'alert' : 'status'}
          className={`w-full text-sm px-3 py-2 rounded border ${
            fetchResult.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {fetchResult.message}
        </p>
      )}
    </section>
  )
}

ReviewSummary.propTypes = {
  aggregate: PropTypes.shape({
    overall_avg: PropTypes.number,
    count: PropTypes.number,
    per_source: PropTypes.object,
    last_fetched_at: PropTypes.string,
  }),
  loading: PropTypes.bool,
  fetching: PropTypes.bool,
  fetchResult: PropTypes.shape({ type: PropTypes.string, message: PropTypes.string }),
  onFetch: PropTypes.func.isRequired,
}
