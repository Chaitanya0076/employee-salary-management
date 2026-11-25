# Performance

Target from the requirements: **p95 < 300 ms** for list and insight endpoints on the seeded dataset (10,000 employees, about 18k compensation records, about 45k components).

## How it's measured
`backend/scripts/benchmark.ts` (`npm run bench`) logs in as the seeded HR Manager, does 5 warm-up requests, then 50 sequential requests per endpoint against a production build (`npm run build && npm start`), and reports p50/p95/max end to end (HTTP + JSON).

Environment: a developer laptop (8 cores, load average about 5 during the runs), PostgreSQL 16 in Docker with default settings, Node 24. Absolute numbers on this machine are noisy (±30%). The comparisons between query shapes are what matter.

## Employees API (prompt-05)

| Endpoint | First version p95 | Final p95 | Final p50 |
|---|---:|---:|---:|
| list, default sort (name) | 24 ms | **33 ms** | 22 ms |
| list, page 200 (offset 4,975) | 151 ms* | **54 ms** | 45 ms |
| list, sort by total pay (USD) | 694 ms ❌ | **114 ms** | 102 ms |
| list, sort by base pay | 483 ms ❌ | **196 ms** | 106 ms |
| list, filter country + level | 40 ms | **30 ms** | 20 ms |
| list, search `q=smith` | 47 ms | **32 ms** | 29 ms |
| list, search `q=an` (2 chars, no trigram help) | 101 ms | **73 ms** | 52 ms |
| employee detail | 37 ms | **31 ms** | 24 ms |
| CSV export, all 10k rows (1.5 MB) | 2,933 ms | **531 ms** | 386 ms |
| CSV export, one country (236 KB) | 341 ms | **201 ms** | 110 ms |

\* 306–478 ms in later runs with the same query; the first figure was a quiet moment on the machine.

### What changed and why
1. **Sorting by pay needs pay for every row.** The first version computed current pay with a per-employee `LATERAL` subquery. With `ORDER BY total_usd` Postgres ran it 10,000 times before it could sort. For pay sorts it's now **one hash aggregate** over current compensations, joined to employees: about 5× faster.
2. **Deep pages shouldn't pay for skipped rows.** With `OFFSET 4975` the per-row subquery also ran for every skipped row. For column sorts (name, code, hire date), the page is now chosen from `employees` alone in a subquery, then pay is computed for just those 25 rows. Cost stays flat at any depth.
3. **Export is one query, streamed in chunks.** The first version fetched 1,000-row batches with `LIMIT/OFFSET`, so each batch re-sorted and re-aggregated: about O(n²) work. Now one query (about 10k rows) is turned into CSV in 1,000-row chunks and streamed with backpressure. Beyond about 100k rows this should become a server-side cursor; at 10k the single query is simpler and fast.

The strategy is chosen per request in `employeeListSql()` (`backend/src/modules/employees/employee.sql.ts`) and covered by unit tests.

### Indexes in use
- **Search:** `q` uses exactly the expression of the `pg_trgm` GIN index `employees_search_trgm_idx` (a unit test guards this). At 10k rows the planner often prefers a sequential scan, which is still fast. When the index is used, a lookup takes about 5 ms. Searches of 1–2 characters can't use trigrams, so they always scan.
- **Current pay:** the partial unique index `compensations(employee_id) WHERE effective_to IS NULL` serves the per-row pay lookup.
- **Filters:** `employees(country_code, department_id, level)` and `employees(status)`.

### Not done (yet)
- **Caching:** every list endpoint already meets the target, so there's nothing to justify a cache here (ADR-0006). Insight endpoints are measured in the analytics step.
- **Denormalising current pay onto `employees`:** would make pay sorts about 10× faster, at the cost of keeping a copy in sync on every pay change. Not worth it while p95 is under target.

## Insights API (prompt-07)

Every insight endpoint aggregates in PostgreSQL over one building block: active employees joined to their open compensation, components summed per employee, and USD equivalents computed unrounded (rounded once, on the aggregate).

| Endpoint | p50 | p95 |
|---|---:|---:|
| summary (all) | 73 ms | 102 ms |
| summary, country=IN | 37 ms | 87 ms |
| by-country | 83 ms | 90 ms |
| by-department | 82 ms | 131 ms |
| by-level (USD) | 77 ms | 95 ms |
| by-level, country=IN | 40 ms | 78 ms |
| distribution (USD) | 140 ms | 243 ms |
| distribution, GB / L3 | 63 ms | 96 ms |
| headcount-trend | 26 ms | 44 ms |
| **whole dashboard: 6 insight calls in parallel** | **205 ms** | **282 ms** |

All endpoints meet the p95 < 300 ms target. The distribution is the slowest because it runs two queries (a range query to plan readable bucket edges, then `width_bucket` counts). The two could be merged with window functions if needed.

### Caching decision (ADR-0006)
**Not enabled yet.** Each insight is well under target, and a full dashboard (six parallel calls) loads in about 200 ms (p50). The cost of a cache is real: invalidation on every employee, pay or FX change, plus a dependency to run. It would pay off if:
- the dataset grows by about 10× (aggregates scale roughly linearly), or
- many HR users load the dashboard at once (the aggregates are CPU-bound in Postgres).

Both are plausible next steps, and the cache interface in ADR-0006 is designed for them. A later step will add it behind `REDIS_URL` and compare against these numbers.

## Test suite
Integration tests originally reset the database with `TRUNCATE ... RESTART IDENTITY`, which took 200–400 ms per test because Postgres recreates and fsyncs the table files. Switching to `DELETE` plus sequence restarts and a single `createMany` per table brought the reset to about 50 ms, and the integration suite from 35 s to about 12 s.
