## Prompt 10 — Dashboard, Insights and FX rates UI

Build the remaining pages in frontend/ against the analytics and reference APIs.

- Dashboard: KPI tiles (headcount, total annual pay USD, average and median pay), pay by
  country and by department charts, headcount trend; each tile/chart links to Insights or a
  pre-filtered Employees view.
- Insights: filters (country, department) in the URL; by-country table (local + USD),
  by-department chart, by-level stats (local currency when one country is selected, else USD),
  base-pay distribution histogram with a bucket-count control, headcount trend.
- Charts with Recharts: accessible (titles, descriptions, data-table fallback), consistent
  colours, compact money axes, tooltips with full values; loading/empty/error states.
- FX rates (Settings): table of rates with last updated; edit a rate inline (USD locked),
  validation mirroring the API, success toast, invalidate analytics queries.
- Tests: KPI rendering from mocked API, filter URL sync on Insights, currency switch rule for
  by-level, FX edit happy path and validation.