import express from 'express';
import pool from '../db.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { 
  validateProductCreate, 
  validateProductUpdate, 
  validateProductId,
  validatePagination,
  validateReviewQuery,
} from '../middleware/validators.js';
import { queries } from '../database/queries.js';
import {
  listReviews,
  aggregateReviews,
  fetchAndStoreReviews,
  normalizeSource,
} from '../services/reviewService.js';

const router = express.Router();

// ===========================================================================
// Team 5 — Multi-Source Review Aggregator routes
// ===========================================================================
// POST /api/products/:id/fetch      -> call scraper, store reviews in MySQL
// GET  /api/products/:id/reviews    -> stored reviews (filter, sort, pagination)
// GET  /api/products/:id/aggregate  -> overall avg, per-source avg, histogram
// Business logic and SQL live in services/reviewService.js.

/**
 * Fetch reviews on demand (only when the user clicks "Fetch Reviews").
 * Response: { data: { product_id, fetched, inserted, updated, skipped, per_source, fetched_at } }
 */
router.post('/:id/fetch', validateProductId, asyncHandler(async (req, res) => {
  const result = await fetchAndStoreReviews(req.params.id);
  res.json(result);
}));

/**
 * Stored reviews — never calls the scraper.
 * Query: ?source=amazon|bestbuy|walmart|all &page=1 &per_page=10 &sort=newest|oldest|rating_desc|rating_asc
 * Response: { data: [review...], meta: { count, total, page, per_page, total_pages, source, sort } }
 */
router.get('/:id/reviews', validateReviewQuery, asyncHandler(async (req, res) => {
  const source = req.query.source && req.query.source !== 'all' ? normalizeSource(req.query.source) : null;
  const result = await listReviews(req.params.id, {
    source,
    page: req.query.page || 1,
    perPage: req.query.per_page || 10,
    sort: req.query.sort || 'newest',
  });
  res.json(result);
}));

/**
 * Aggregated statistics computed from stored reviews.
 * Response: { data: { overall_avg, count, per_source, histogram, timeline, last_fetched_at } }
 */
router.get('/:id/aggregate', validateProductId, asyncHandler(async (req, res) => {
  const result = await aggregateReviews(req.params.id);
  res.json(result);
}));

/**
 * List products with category name (JOIN) — supports pagination and optional category filter
 * Query params: page (1-based), per_page, category_id
 * 
 * Student Note: This route now uses our centralized query builder from queries.js
 * This demonstrates the DRY principle - we don't repeat the same JOIN query in multiple places.
 * The query builder handles the dynamic WHERE clause construction for us.
 */
router.get('/', validatePagination, asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.max(1, Math.min(100, Number(req.query.per_page) || 10));
  const categoryFilter = req.query.category_id ? Number(req.query.category_id) : null;

  // Use centralized query builders - no more duplicated SQL!
  // Teaching note: The query builder handles parameter binding and WHERE clause construction
  const [countQuery, countParams] = queries.products.countTotal(categoryFilter);
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0]?.total || 0;

  // Fetch paginated products using the query builder
  const [dataQuery, dataParams] = queries.products.selectPaginated({
    page,
    perPage,
    categoryId: categoryFilter
  });
  const [rows] = await pool.query(dataQuery, dataParams);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  res.json({
    data: rows,
    meta: {
      total,
      page,
      per_page: perPage,
      total_pages: totalPages,
    }
  });
}));

/**
 * Get product by id with category
 * 
 * Student Note: Now using the centralized query builder for consistency.
 * The same JOIN query is used everywhere, making maintenance easier.
 */
router.get('/:id', validateProductId, asyncHandler(async (req, res) => {
  const id = req.params.id; // Already validated and converted to number
  
  // Use the centralized query builder - ensures consistent JOIN logic
  const [query, params] = queries.products.selectById(id);
  const [rows] = await pool.query(query, params);
  
  if (rows.length === 0) {
    throw new AppError('Product not found', 404);
  }
  
  res.json(rows[0]);
}));

/**
 * Create product
 * 
 * Student Note: This demonstrates the compound operation pattern - INSERT then SELECT.
 * We use the query builder to ensure the SELECT uses the same JOIN logic as other routes.
 * This pattern is common in REST APIs where you want to return the created resource.
 */
router.post('/', validateProductCreate, asyncHandler(async (req, res) => {
  const productData = req.body;
  
  // Use the query builder for the compound INSERT + SELECT operation
  const queryBuilders = queries.products.insertAndSelect(productData);
  
  // Execute the INSERT query
  const [insertQuery, insertParams] = queryBuilders.insert;
  const [result] = await pool.query(insertQuery, insertParams);
  
  // Execute the SELECT query to get the created product with category info
  const insertId = result.insertId;
  const [selectQuery, selectParams] = queryBuilders.selectAfterInsert(insertId);
  const [rows] = await pool.query(selectQuery, selectParams);
  
  res.status(201).json(rows[0]);
}));

/**
 * Update product
 * 
 * Student Note: Another compound operation - UPDATE then SELECT.
 * We use the query builder to maintain consistency with other routes.
 * The same JOIN query is used to return the updated product with category info.
 */
router.put('/:id', validateProductUpdate, asyncHandler(async (req, res) => {
  const id = req.params.id;
  const productData = req.body;
  
  // Use the query builder for the compound UPDATE + SELECT operation
  const queryBuilders = queries.products.updateAndSelect(id, productData);
  
  // Execute the UPDATE query
  const [updateQuery, updateParams] = queryBuilders.update;
  const [result] = await pool.query(updateQuery, updateParams);
  
  if (result.affectedRows === 0) {
    throw new AppError('Product not found', 404);
  }
  
  // Execute the SELECT query to get the updated product with category info
  const [selectQuery, selectParams] = queryBuilders.selectAfterUpdate();
  const [rows] = await pool.query(selectQuery, selectParams);
  
  res.json(rows[0]);
}));

/**
 * Delete product
 * 
 * Student Note: Even simple queries benefit from centralization.
 * If we later need to add soft deletes or cascade logic, 
 * we only need to change the query builder.
 */
router.delete('/:id', validateProductId, asyncHandler(async (req, res) => {
  const id = req.params.id;
  
  // Use the centralized delete query
  const [query, params] = queries.products.deleteById(id);
  const [result] = await pool.query(query, params);
  
  if (result.affectedRows === 0) {
    throw new AppError('Product not found', 404);
  }
  
  res.status(204).send();
}));

export default router;
