## Prompt 07 — Insights (analytics) API

Following docs/architecture.md §6 and docs/requirements.md (Insights), add the analytics module
to backend/ (all routes protected). Only ACTIVE employees and their current compensation count.

- GET /api/analytics/summary?country&department: headcount, total annual pay (USD),
  average and median total pay (USD).
- GET /api/analytics/by-country?department: per country: headcount, total pay in local currency
  and USD, avg/median/min/max base (local).
- GET /api/analytics/by-department?country: per department: headcount, total pay USD,
  avg/median base USD.
- GET /api/analytics/by-level?country&department: per level: avg/median/min/max base
  (local currency when country is given, otherwise USD).
- GET /api/analytics/distribution?country&level&buckets: base-pay histogram (local currency when
  country is given, otherwise USD); bucket edges rounded to readable values.
- GET /api/analytics/headcount-trend?country&department: hires per year and cumulative headcount.
- Aggregations run in SQL (percentile_cont, width_bucket); money as exact decimal strings.
- Tests: unit tests for query building and bucket rounding; integration tests on the fixtures
  with hand-computed expected values (incl. median with even counts, inactive excluded).
- Benchmark the endpoints with npm run bench on the 10k data and add the results to
  docs/performance.md (decide on caching later, per ADR-0006).