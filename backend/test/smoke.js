/**
 * Smoke test for the backend API (student-friendly)
 *
 * Purpose:
 * - Provide a tiny, fast suite that verifies the backend + DB are running.
 * - Exit with code 0 on success, non-zero on failure (works well in CI and Docker healthchecks).
 *
 * How to run:
 * - Run backend locally: `cd backend && npm run dev` (ensure DB is running)
 * - From the repo root: `npm --workspace=backend test` or `cd backend && npm test`
 * - Override URL for testing remote/containers: `TEST_URL=http://localhost:4000 node test/smoke.js`
 *
 * Teaching notes / debugging tips:
 * - If a test fails, read the printed error and check the backend logs (nodemon output).
 * - Confirm MySQL is running and reachable; when using Docker Compose, run `docker compose up -d mysql`.
 * - The global `fetch` API is available in Node 18+; this test uses it directly.
 * - This script demonstrates: assertions, clear exit codes, success vs error cases, and how to write focused smoke tests.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:4000';

async function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runTests() {
  console.log('🧪 Running smoke tests...\n');

  // Test 1: Health endpoint
  // - Quick server + DB sanity check used by Docker Compose healthchecks
  try {
    const res = await fetch(`${BASE_URL}/health`);
    await assert(res.ok, 'Health endpoint returns 200');
    const body = await res.json();
    await assert(body.status === 'ok', 'Health endpoint has status: ok');
    await assert(body.db === 'connected', 'Database is connected');
    console.log(`   Products in DB: ${body.products}\n`);
  } catch (err) {
    console.error(`❌ FAIL: Health endpoint error - ${err.message}`);
    console.error('   Hint: Start the database (docker compose up -d mysql) and re-run.');
    process.exit(1);
  }

  // Test 2: List products endpoint
  // - Verifies pagination + response shape
  try {
    const res = await fetch(`${BASE_URL}/api/products`);
    await assert(res.ok, 'GET /api/products returns 200');
    const body = await res.json();
    await assert(body.data && Array.isArray(body.data), 'Response has data array');
    await assert(body.meta && typeof body.meta.total === 'number', 'Response has pagination meta');
    console.log(`   Found ${body.data.length} products (${body.meta.total} total)\n`);
  } catch (err) {
    console.error(`❌ FAIL: List products error - ${err.message}`);
    console.error('   Tip: If this fails, check backend logs for SQL errors or missing seed data.');
    process.exit(1);
  }

  // Test 3: List categories endpoint
  // - Verifies categories route returns an array (simple read test)
  try {
    const res = await fetch(`${BASE_URL}/api/categories`);
    await assert(res.ok, 'GET /api/categories returns 200');
    const body = await res.json();
    await assert(Array.isArray(body), 'Categories response is an array');
    await assert(body.length > 0, 'At least one category exists');
    console.log(`   Found ${body.length} categories\n`);
  } catch (err) {
    console.error(`❌ FAIL: List categories error - ${err.message}`);
    console.error('   Tip: Ensure the DB init SQL ran (db/init.sql) and seeded categories.');
    process.exit(1);
  }

  // Test 4: 404 for unknown route
  // - Makes sure unknown routes return 404 and do not leak server errors
  try {
    const res = await fetch(`${BASE_URL}/api/nonexistent`);
    await assert(res.status === 404, 'Unknown route returns 404');
    console.log('');
  } catch (err) {
    console.error(`❌ FAIL: 404 test error - ${err.message}`);
    process.exit(1);
  }

  // Test 5: Invalid product ID
  // - Confirms the API correctly returns 404 for missing resources
  try {
    const res = await fetch(`${BASE_URL}/api/products/99999`);
    await assert(res.status === 404, 'Non-existent product returns 404');
    console.log('');
  } catch (err) {
    console.error(`❌ FAIL: Invalid ID test error - ${err.message}`);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Team 5 — Review aggregator tests (need MySQL + scraper running)
  // ---------------------------------------------------------------------------

  // Test 6: aggregate shape (works even before any fetch)
  try {
    const res = await fetch(`${BASE_URL}/api/products/1/aggregate`);
    await assert(res.ok, 'GET /api/products/1/aggregate returns 200');
    const { data } = await res.json();
    await assert(data && 'overall_avg' in data && 'per_source' in data, 'Aggregate has overall_avg and per_source');
    await assert([1, 2, 3, 4, 5].every((k) => typeof data.histogram[k] === 'number'), 'Histogram has keys 1..5');
    console.log('');
  } catch (err) {
    console.error(`❌ FAIL: Aggregate test error - ${err.message}`);
    process.exit(1);
  }

  // Test 7: fetch twice -> no duplicates (UNIQUE key + upsert)
  try {
    const wait = (ms) => new Promise((r) => globalThis.setTimeout(r, ms));
    const first = await fetch(`${BASE_URL}/api/products/1/fetch`, { method: 'POST' });
    if (first.status === 429) await wait(6000); // a previous run just fetched product 1
    const fetchRes = first.status === 429 ? await fetch(`${BASE_URL}/api/products/1/fetch`, { method: 'POST' }) : first;
    await assert(fetchRes.ok, 'POST /api/products/1/fetch returns 200 (scraper reachable)');
    const { data: fetched } = await fetchRes.json();
    const before = await (await fetch(`${BASE_URL}/api/products/1/reviews?per_page=50`)).json();
    await assert(before.meta.total === fetched.fetched, `Stored reviews (${before.meta.total}) = scraped reviews (${fetched.fetched})`);

    await wait(Number(process.env.FETCH_COOLDOWN_MS ?? 5000) + 500);
    const again = await (await fetch(`${BASE_URL}/api/products/1/fetch`, { method: 'POST' })).json();
    await assert(again.data.inserted === 0, 'Second fetch inserts 0 new rows');
    const after = await (await fetch(`${BASE_URL}/api/products/1/reviews?per_page=50`)).json();
    await assert(after.meta.total === before.meta.total, 'Review count unchanged after re-fetch (no duplicates)');
    await assert(Object.keys(after.data[0]).length === 8, 'Review objects have exactly 8 fields');
    console.log('');
  } catch (err) {
    console.error(`❌ FAIL: Fetch/duplicate test error - ${err.message}`);
    console.error('   Hint: start the scraper (npm run dev:scraper) on http://localhost:5000.');
    process.exit(1);
  }

  // Test 8: filter by source + validation
  try {
    const res = await fetch(`${BASE_URL}/api/products/1/reviews?source=amazon`);
    const body = await res.json();
    await assert(body.data.every((r) => r.source === 'Amazon'), 'source=amazon returns only Amazon reviews');
    const bad = await fetch(`${BASE_URL}/api/products/1/reviews?source=ebay`);
    await assert(bad.status === 400, 'Unknown source returns 400');
    const missing = await fetch(`${BASE_URL}/api/products/99999/reviews`);
    await assert(missing.status === 404, 'Reviews of unknown product return 404');
    console.log('');
  } catch (err) {
    console.error(`❌ FAIL: Filter test error - ${err.message}`);
    process.exit(1);
  }

  console.log('✅ All tests passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Unexpected test error:', err);
  process.exit(1);
});
