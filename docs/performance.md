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

Both are plausible next steps, and the cache design in ADR-0006 is meant for them.

## Production (Render free instance)

Server-side durations from the API access log (`ms` field, excluding network), taken while loading the live app through Vercel right after a deploy:

| Endpoint | Local (p50) | Render free |
|---|---:|---:|
| `GET /api/analytics/summary` | 73 ms | 1,609–1,955 ms |
| `GET /api/analytics/by-country` | 83 ms | ~2,280 ms |
| `GET /api/analytics/by-department` | 82 ms | 2,101–2,321 ms |
| `GET /api/analytics/headcount-trend` | 26 ms | 13–277 ms |
| `GET /api/employees` (default page) | 22 ms | 439–493 ms |
| `GET /api/auth/me` | — | 169–204 ms |
| `GET /api/fx-rates`, `/api/countries` | — | 5–9 ms |

These are a handful of samples, not percentiles, but the gap is clear. Insight endpoints are **10–25× slower** on the free tier, so the **dashboard takes about 2–2.5 s** to fill, against the 300 ms target. Two causes:
- The free web instance gets a fraction of one CPU.
- The free PostgreSQL instance is small and shared; each insight query scans all ~45k pay components.

Small lookups stay fast, which confirms the cost is the aggregation, not the network or the proxies.

### What this means for caching (ADR-0006)
This is the trigger ADR-0006 named: aggregates bound by CPU. Caching would help repeated dashboard loads, because the same few queries are asked again and again while the data rarely changes. **It still isn't built**, deliberately:
1. **Cheapest fix first.** A paid instance (Render Starter and a basic Postgres plan) should bring this close to the local numbers. It's a configuration change, with no code to maintain.
2. **If caching is added, Redis isn't needed for one instance.** The ADR's in-memory adapter with namespace-version invalidation removes the repeat cost. Redis only matters once there are several API instances.
3. **Scope.** This step froze features; the measurement and the design are recorded so the next person can act on numbers rather than guesses.

The first load after a write is always uncached, so caching doesn't remove the need for adequate hardware; it reduces the cost of repeat reads.

## Test suite
Integration tests originally reset the database with `TRUNCATE ... RESTART IDENTITY`, which took 200–400 ms per test because Postgres recreates and fsyncs the table files. Switching to `DELETE` plus sequence restarts and a single `createMany` per table brought the reset to about 50 ms, and the integration suite from 35 s to about 12 s.
