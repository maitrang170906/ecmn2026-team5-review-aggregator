/**
 * Review service — all SQL for the reviews feature lives here
 *
 * Team 5 notes:
 * - Routes stay thin (HTTP in / JSON out); this file holds the business logic.
 * - Every query is parameterized with `?` placeholders: user input is never
 *   concatenated into SQL (protection against SQL injection).
 * - The API always returns the same 8 review fields:
 *   review_id, source, author, rating, title, body, created_at, verified_purchase
 *   (product_id stays in the WHERE clause, not in the response).
 */

import pool from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { scrapeProductReviews } from './scraperClient.js';

/** Canonical source names, used to normalize what the scraper sends. */
export const SOURCES = ['Amazon', 'BestBuy', 'Walmart'];
const SOURCE_LOOKUP = new Map(SOURCES.map((s) => [s.toLowerCase(), s]));

/** Normalize a source name ("amazon", "AMAZON" -> "Amazon"), or null if unknown. */
export function normalizeSource(value) {
  if (typeof value !== 'string') return null;
  return SOURCE_LOOKUP.get(value.trim().toLowerCase()) ?? null;
}

/** Columns returned to the client (the 8-field review shape). */
const REVIEW_COLUMNS = `review_id, source, author, rating, title, body, created_at, verified_purchase`;

/** Convert a DB row into the API shape (booleans and ISO dates). */
function toApiReview(row) {
  return {
    review_id: row.review_id,
    source: row.source,
    author: row.author,
    rating: Number(row.rating),
    title: row.title,
    body: row.body,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    verified_purchase: Boolean(row.verified_purchase),
  };
}

/** Throws 404 if the product does not exist in the catalog. */
export async function assertProductExists(productId) {
  const [rows] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
  if (rows.length === 0) {
    throw new AppError('Product not found', 404);
  }
}

// ---------------------------------------------------------------------------
// GET /api/products/:id/reviews
// ---------------------------------------------------------------------------

const SORTS = {
  newest: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  rating_desc: 'rating DESC, created_at DESC',
  rating_asc: 'rating ASC, created_at DESC',
};

/**
 * Paginated list of stored reviews, optionally filtered by source.
 * Sorting uses a whitelist (SORTS) because ORDER BY cannot be parameterized.
 */
export async function listReviews(productId, { source = null, page = 1, perPage = 10, sort = 'newest' } = {}) {
  await assertProductExists(productId);

  const where = ['product_id = ?'];
  const params = [productId];
  if (source) {
    where.push('source = ?');
    params.push(source);
  }
  const whereSql = where.join(' AND ');
  const orderBy = SORTS[sort] || SORTS.newest;

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM reviews WHERE ${whereSql}`, params);

  const offset = (page - 1) * perPage;
  const [rows] = await pool.query(
    `SELECT ${REVIEW_COLUMNS} FROM reviews WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );

  return {
    data: rows.map(toApiReview),
    meta: {
      count: rows.length,
      total: Number(total),
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil(Number(total) / perPage)),
      source: source || 'all',
      sort: SORTS[sort] ? sort : 'newest',
    },
  };
}

// ---------------------------------------------------------------------------
// GET /api/products/:id/aggregate
// ---------------------------------------------------------------------------

const round2 = (n) => (n === null || n === undefined ? null : Math.round(Number(n) * 100) / 100);

/**
 * Statistics computed in SQL (AVG / COUNT / GROUP BY) rather than in JS:
 * the database does the heavy lifting and only small results travel.
 */
export async function aggregateReviews(productId) {
  await assertProductExists(productId);

  const [[overall]] = await pool.query(
    `SELECT COUNT(*) AS count, AVG(rating) AS avg, MAX(fetched_at) AS last_fetched_at
       FROM reviews WHERE product_id = ?`,
    [productId]
  );

  const [bySource] = await pool.query(
    `SELECT source, COUNT(*) AS count, AVG(rating) AS avg
       FROM reviews WHERE product_id = ?
      GROUP BY source ORDER BY source`,
    [productId]
  );

  const [byRating] = await pool.query(
    `SELECT rating, COUNT(*) AS count
       FROM reviews WHERE product_id = ?
      GROUP BY rating`,
    [productId]
  );

  // Week buckets (Monday) for the optional trend timeline
  const [byWeek] = await pool.query(
    `SELECT DATE_FORMAT(DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d') AS week,
            COUNT(*) AS count, AVG(rating) AS avg
       FROM reviews WHERE product_id = ?
      GROUP BY week ORDER BY week`,
    [productId]
  );

  // Histogram always has keys 1..5, even when a bucket is empty
  const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of byRating) histogram[row.rating] = Number(row.count);

  const perSource = {};
  for (const row of bySource) {
    perSource[row.source] = { avg: round2(row.avg), count: Number(row.count) };
  }

  const count = Number(overall.count);
  return {
    data: {
      overall_avg: count ? round2(overall.avg) : null,
      count,
      per_source: perSource,
      histogram,
      timeline: byWeek.map((r) => ({ week: r.week, avg: round2(r.avg), count: Number(r.count) })),
      last_fetched_at: overall.last_fetched_at ? new Date(overall.last_fetched_at).toISOString() : null,
    },
  };
}

// ---------------------------------------------------------------------------
// POST /api/products/:id/fetch
// ---------------------------------------------------------------------------

// On-demand fetching + a small per-product cooldown so repeated clicks do not
// hammer the external sources (respecting their rate limits).
const FETCH_COOLDOWN_MS = Number(process.env.FETCH_COOLDOWN_MS ?? 5000);
const lastFetchByProduct = new Map();

/**
 * Validate and normalize one review coming from the scraper.
 * Returns null when the review cannot be stored safely (it is then skipped).
 */
export function normalizeScrapedReview(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = normalizeSource(raw.source);
  const rating = Number(raw.rating);
  const reviewId = raw.review_id != null ? String(raw.review_id).trim() : '';
  if (!source || !reviewId || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;

  const created = new Date(raw.created_at);
  return {
    review_id: reviewId.slice(0, 64),
    source,
    author: (typeof raw.author === 'string' && raw.author.trim() ? raw.author.trim() : 'Anonymous').slice(0, 100),
    rating,
    title: typeof raw.title === 'string' ? raw.title.slice(0, 255) : null,
    body: typeof raw.body === 'string' ? raw.body : null,
    created_at: Number.isNaN(created.getTime()) ? new Date() : created,
    verified_purchase: Boolean(raw.verified_purchase),
  };
}

/**
 * Fetch reviews from the scraper and upsert them in MySQL.
 * - New review          -> INSERT (affectedRows = 1)
 * - Already stored one  -> UPDATE content + fetched_at (affectedRows = 2), no duplicate row
 * The whole batch runs in one transaction: either every review is saved or none.
 */
export async function fetchAndStoreReviews(productId) {
  await assertProductExists(productId);

  const last = lastFetchByProduct.get(productId);
  if (last && Date.now() - last < FETCH_COOLDOWN_MS) {
    const retryAfter = Math.ceil((FETCH_COOLDOWN_MS - (Date.now() - last)) / 1000);
    throw new AppError(`Reviews were just fetched. Please wait ${retryAfter}s before fetching again.`, 429, {
      retry_after: retryAfter,
    });
  }
  lastFetchByProduct.set(productId, Date.now());

  let rawReviews;
  try {
    ({ reviews: rawReviews } = await scrapeProductReviews(productId));
  } catch (err) {
    // A failed call should not block the user from retrying right away
    lastFetchByProduct.delete(productId);
    throw err;
  }
  const reviews = rawReviews.map(normalizeScrapedReview).filter(Boolean);
  const skipped = rawReviews.length - reviews.length;

  let inserted = 0;
  let updated = 0;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of reviews) {
      const [result] = await conn.query(
        `INSERT INTO reviews
           (product_id, source, review_id, author, rating, title, body, created_at, verified_purchase, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           author = VALUES(author), rating = VALUES(rating), title = VALUES(title),
           body = VALUES(body), verified_purchase = VALUES(verified_purchase), fetched_at = NOW()`,
        [productId, r.source, r.review_id, r.author, r.rating, r.title, r.body, r.created_at, r.verified_purchase]
      );
      if (result.affectedRows === 1) inserted += 1;
      else updated += 1;
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const perSource = {};
  for (const r of reviews) perSource[r.source] = (perSource[r.source] || 0) + 1;

  return {
    data: {
      product_id: productId,
      fetched: rawReviews.length,
      inserted,
      updated,
      skipped,
      per_source: perSource,
      fetched_at: new Date().toISOString(),
    },
  };
}
