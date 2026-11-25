import { useCallback, useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// useProductReviews(backend, productId, options) — Team 5 custom hook
// ---------------------------------------------------------------------------
// Keeps all review data logic out of the components:
//  - loads aggregated stats      GET  /api/products/:id/aggregate
//  - loads the stored reviews    GET  /api/products/:id/reviews?source&page&per_page&sort
//  - fetches new reviews         POST /api/products/:id/fetch   (only on user click)
//
// Teaching points:
//  - AbortController cancels an outdated request when the product, filter or
//    page changes quickly, so an old response can never overwrite a new one.
//  - `version` is bumped after a successful fetch: both effects depend on it,
//    so the stats and the list reload automatically.
//  - The hook returns plain state + functions; components only render.
// ---------------------------------------------------------------------------

async function readJson(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Backend errors look like { error: { message, status, details } }
    const message = body?.error?.message || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return body
}

export function useProductReviews(backend, productId, { source = 'all', page = 1, perPage = 5, sort = 'newest' } = {}) {
  const [aggregate, setAggregate] = useState(null)
  const [aggregateLoading, setAggregateLoading] = useState(true)
  const [reviews, setReviews] = useState([])
  const [meta, setMeta] = useState(null)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState(null) // { type: 'success' | 'error', message }
  const [version, setVersion] = useState(0)

  // 1) Aggregated statistics
  useEffect(() => {
    if (!productId) return undefined
    const controller = new globalThis.AbortController()
    setAggregateLoading(true)
    fetch(`${backend}/api/products/${productId}/aggregate`, { signal: controller.signal })
      .then(readJson)
      .then((body) => { setAggregate(body.data); setError(null) })
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setAggregateLoading(false) })
    return () => controller.abort()
  }, [backend, productId, version])

  // 2) Stored reviews (filtered / sorted / paginated)
  useEffect(() => {
    if (!productId) return undefined
    const controller = new globalThis.AbortController()
    const params = new globalThis.URLSearchParams({ page: String(page), per_page: String(perPage), sort })
    if (source && source !== 'all') params.set('source', source)
    setReviewsLoading(true)
    fetch(`${backend}/api/products/${productId}/reviews?${params}`, { signal: controller.signal })
      .then(readJson)
      .then((body) => { setReviews(body.data); setMeta(body.meta); setError(null) })
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setReviewsLoading(false) })
    return () => controller.abort()
  }, [backend, productId, source, page, perPage, sort, version])

  // 3) On-demand fetch from the scraper (Amazon / BestBuy / Walmart)
  const fetchReviews = useCallback(async () => {
    setFetching(true)
    setFetchResult(null)
    try {
      const res = await fetch(`${backend}/api/products/${productId}/fetch`, { method: 'POST' })
      const { data } = await readJson(res)
      const parts = Object.entries(data.per_source || {}).map(([s, n]) => `${s} ${n}`).join(', ')
      setFetchResult({
        type: 'success',
        message: `Fetched ${data.fetched} reviews (${parts || 'no source'}): ${data.inserted} new, ${data.updated} already stored.`,
      })
      setVersion((v) => v + 1) // reload stats + list
    } catch (err) {
      setFetchResult({ type: 'error', message: err.message })
    } finally {
      setFetching(false)
    }
  }, [backend, productId])

  return {
    aggregate,
    reviews,
    meta,
    loading: aggregateLoading || reviewsLoading,
    aggregateLoading,
    reviewsLoading,
    error,
    fetching,
    fetchResult,
    fetchReviews,
    reload: () => setVersion((v) => v + 1),
  }
}

export default useProductReviews
