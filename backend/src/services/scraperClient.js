/**
 * Scraper client — talks to the mock scraper-service (Amazon, BestBuy, Walmart)
 *
 * Team 5 notes:
 * - The backend is the only part of the app that calls the scraper. The React
 *   frontend never calls it directly (keeps rate limits and URLs server-side).
 * - We use the global fetch() available in Node 18+ (no axios needed).
 * - Every network problem is turned into an AppError with a clear HTTP status
 *   so the frontend can show a helpful message:
 *     scraper down / refused  -> 503 Service Unavailable
 *     scraper too slow        -> 504 Gateway Timeout
 *     no reviews for product  -> 404 Not Found
 *     anything unexpected     -> 502 Bad Gateway
 */

import { AppError } from '../middleware/errorHandler.js';

// In Docker Compose the scraper is reachable by its service name (http://scraper:5000).
// When running everything locally (npm run dev / XAMPP) it is http://localhost:5000.
const SCRAPER_URL = (process.env.SCRAPER_URL || 'http://localhost:5000').replace(/\/$/, '');
const SCRAPER_TIMEOUT_MS = Number(process.env.SCRAPER_TIMEOUT_MS) || 8000;

/**
 * Fetch all reviews for one product from every source.
 * @param {number|string} productId
 * @returns {Promise<{ reviews: object[], fetchedAt: string }>}
 */
export async function scrapeProductReviews(productId) {
  const url = `${SCRAPER_URL}/api/scrape/reviews/${encodeURIComponent(productId)}`;

  let res;
  try {
    res = await globalThis.fetch(url, { signal: globalThis.AbortSignal.timeout(SCRAPER_TIMEOUT_MS) });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new AppError(`Scraper did not answer within ${SCRAPER_TIMEOUT_MS} ms`, 504);
    }
    // ECONNREFUSED, DNS errors... => the scraper is not running
    throw new AppError('Scraper service unavailable. Is it running on ' + SCRAPER_URL + '?', 503);
  }

  if (res.status === 404) {
    throw new AppError('No reviews available from the sources for this product', 404);
  }
  if (!res.ok) {
    throw new AppError(`Scraper returned HTTP ${res.status}`, 502);
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new AppError('Scraper returned invalid JSON', 502);
  }

  if (!payload || !Array.isArray(payload.data)) {
    throw new AppError('Unexpected scraper response format (missing data array)', 502);
  }

  return {
    reviews: payload.data,
    fetchedAt: payload.fetched_at || new Date().toISOString(),
  };
}
