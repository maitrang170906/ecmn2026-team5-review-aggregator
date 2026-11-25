# LLM Usage — Team 5

**Tool:** Claude (Anthropic, Claude app with code execution), used as a pair-programmer on top of the course starter `ebpro/fullstack-minimal-app`.
**Used for:** reading the course pages, planning the architecture, writing the backend services/routes, the React hook and components, the smoke tests and a first draft of the README and of this file. The team then ran the app on our own laptops, read the code and edited the documentation.

## 1. Prompts

| Step | Prompt (summary) | Result |
|---|---|---|
| Context | Gave the project page URL + the teacher's submission requirements, then *"Help us complete the project step by step"*; answered that we had no code and no scraper yet | Claude read the course pages, found that the scraper is in the starter repo (`scraper-service/`, port 5000) and proposed extending the starter instead of starting from scratch |
| Constraints | Course conventions taken from the practice pages: ES modules, `mysql2/promise` pool in `db.js`, parameterized `?` queries, `{ data, meta }` responses, 8-field review object, histogram keys 1–5 even when empty | Code follows the same style as the starter (asyncHandler, AppError, express-validator, PropTypes, Tailwind) |
| Backend | 3 endpoints, on-demand fetch, no duplicates, rate limits | `reviewService.js` (upsert in a transaction, SQL aggregates), `scraperClient.js` (timeout, 503/504/404 mapping), 5 s cooldown |
| Frontend | `useProductReviews(productId)` hook + ProductPage, SourceBreakdown, ReviewList, ReviewStats | Hook with AbortController and auto-reload after fetch; CSS bar charts (no chart library) |

**Lesson:** giving the exact conventions (response shapes, file names, module system) produced code that fits the starter; a vague prompt would have produced a different structure.

## 2. Verification

Generated code was never accepted without running it. Claude ran these checks in its own sandbox while building, and we repeated the main ones on our laptops:
- **Real database:** ran `db/init.sql` on MariaDB (same engine as XAMPP) and the real scraper service.
- **Hand-checked numbers:** product 1 → Amazon (5+4+5+3+5)/5 = 4.40, BestBuy 13/3 = 4.33, Walmart 12/3 = 4.00, overall 47/11 = 4.27, histogram 3★=2, 4★=4, 5★=5 → matches `/aggregate`.
- **No duplicates:** fetched twice → second call `inserted: 0, updated: 11`; `SELECT COUNT(*)` in SQL still 11.
- **Error cases:** stopped the scraper (→ 503), unknown product (→ 404), product without scraper data (→ 404), `source=ebay` (→ 400), double click (→ 429).
- **Automated:** extended `backend/test/smoke.js` (all tests pass) and ran ESLint on backend and frontend.
- **UI:** took browser screenshots of every state (empty, fetched, filtered, error) and fixed what looked wrong.

## 3. Challenges (where the AI output was wrong or incomplete)

- **ESLint failed** on `fetch` / `AbortSignal` "not defined" in the backend → used `globalThis.fetch`, as the starter already does for `setTimeout`.
- **Layout bugs only visible on screen:** the per-source bars collapsed to a few pixels (table cell without width) and the fetch message was squeezed next to the button → fixed after looking at screenshots.
- **Pagination bug in the starter, found by us while testing on a Mac:** the product list "Next" button stayed on page 1. Cause: `fetchPage` depended on `page`, so changing page re-ran the "reset to page 1" effect. Fixed by passing page/filter as arguments and using a single effect (checked: the original code stays on page 1, the fix goes 1 → 2 → 3 → 2).
- **Empty password bug (inherited from the starter):** `DB_PASSWORD || 'apppassword'` ignores an empty password, so XAMPP's `root` user could not connect → changed to `??`.
- **Cooldown too strict:** first version blocked a retry for 5 s even when the scraper was down → cooldown is now cleared when the call fails.
- **Time zone:** review dates are UTC; with MySQL in local time (Vietnam, UTC+7) dates could shift → pool forced to UTC.
- **Docs vs code:** a course page says the scraper regenerates reviews on each call, but its source code returns fixed data; it also only knows product IDs 1–3 → we read the code and documented the limitation in the README.

## 4. Reflection

The LLM made us much faster on boilerplate (routes, validation, components). Human judgment was still needed to check the numbers, test failure cases, look at the real UI and catch bugs that only appear on a specific setup (XAMPP, time zone).
