import PropTypes from 'prop-types'
import StarRating from './StarRating'
import { SOURCES, sourceStyle } from './sources'

// List of stored reviews with source filter, sorting and pagination.
// The filter/sort/page state lives in the parent (ReviewSection) because the
// custom hook needs it to build the request URL.
export default function ReviewList({ reviews, meta, loading, source, onSourceChange, sort, onSortChange, page, onPageChange }) {
  const tabs = [{ id: 'all', name: 'All' }, ...SOURCES]
  const totalPages = meta?.total_pages ?? 1

  return (
    <section className="bg-white rounded-lg border p-4" aria-labelledby="review-list-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 id="review-list-heading" className="font-semibold text-gray-900">
          Reviews {meta && <span className="text-gray-400 font-normal">({meta.total})</span>}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter by source" className="inline-flex rounded-md border overflow-hidden text-sm">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSourceChange(t.id)}
                aria-pressed={source === t.id}
                className={`px-3 py-1.5 border-r last:border-r-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  source === t.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="review-sort">Sort reviews</label>
          <select
            id="review-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="border rounded-md px-2 py-1.5 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="rating_desc">Highest rating</option>
            <option value="rating_asc">Lowest rating</option>
          </select>
        </div>
      </div>

      {loading && reviews.length === 0 ? (
        <p className="py-6 text-center text-gray-500">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="py-6 text-center text-gray-500">No reviews to show{source !== 'all' ? ' for this source' : ''}.</p>
      ) : (
        <ul className={`divide-y ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
          {reviews.map((r) => (
            <li key={`${r.source}-${r.review_id}`} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StarRating value={r.rating} />
                <span className="font-medium text-gray-900">{r.title}</span>
              </div>
              <p className="mt-1 text-gray-700 text-sm">{r.body}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className={`px-2 py-0.5 rounded-full font-medium ${sourceStyle(r.source).badge}`}>{r.source}</span>
                <span>{r.author}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString()}</time>
                {r.verified_purchase && <span className="text-emerald-700">✓ Verified purchase</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-3 flex items-center justify-between text-sm" aria-label="Review pagination">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            ← Previous
          </button>
          <span className="text-gray-600">Page {page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </nav>
      )}
    </section>
  )
}

ReviewList.propTypes = {
  reviews: PropTypes.arrayOf(PropTypes.shape({
    review_id: PropTypes.string,
    source: PropTypes.string,
    author: PropTypes.string,
    rating: PropTypes.number,
    title: PropTypes.string,
    body: PropTypes.string,
    created_at: PropTypes.string,
    verified_purchase: PropTypes.bool,
  })).isRequired,
  meta: PropTypes.shape({ total: PropTypes.number, total_pages: PropTypes.number }),
  loading: PropTypes.bool,
  source: PropTypes.string.isRequired,
  onSourceChange: PropTypes.func.isRequired,
  sort: PropTypes.string.isRequired,
  onSortChange: PropTypes.func.isRequired,
  page: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
}
