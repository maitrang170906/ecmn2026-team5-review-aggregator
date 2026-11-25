import { useState } from 'react'
import PropTypes from 'prop-types'
import { useProductReviews } from '../../hooks/useProductReviews'
import ReviewSummary from './ReviewSummary'
import SourceBreakdown from './SourceBreakdown'
import ReviewStats from './ReviewStats'
import ReviewList from './ReviewList'

// Container component: owns the UI state (filter, sort, page), gets data from
// the useProductReviews hook and passes it down to presentational components.
const PER_PAGE = 5

export default function ReviewSection({ backend, productId }) {
  const [source, setSource] = useState('all')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)

  const {
    aggregate, reviews, meta, aggregateLoading, reviewsLoading, error, fetching, fetchResult, fetchReviews,
  } = useProductReviews(backend, productId, { source, page, perPage: PER_PAGE, sort })

  const hasReviews = (aggregate?.count ?? 0) > 0

  return (
    <div className="space-y-4">
      <ReviewSummary
        aggregate={aggregate}
        loading={aggregateLoading}
        fetching={fetching}
        fetchResult={fetchResult}
        onFetch={fetchReviews}
      />

      {error && (
        <div role="alert" className="p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">
          Could not load reviews: {error}
        </div>
      )}

      {hasReviews && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <SourceBreakdown perSource={aggregate.per_source} />
            <ReviewStats histogram={aggregate.histogram} timeline={aggregate.timeline} count={aggregate.count} />
          </div>
          <ReviewList
            reviews={reviews}
            meta={meta}
            loading={reviewsLoading}
            source={source}
            onSourceChange={(s) => { setSource(s); setPage(1) }}
            sort={sort}
            onSortChange={(s) => { setSort(s); setPage(1) }}
            page={page}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}

ReviewSection.propTypes = {
  backend: PropTypes.string.isRequired,
  productId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
}
