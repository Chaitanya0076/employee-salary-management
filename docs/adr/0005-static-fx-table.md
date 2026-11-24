# ADR-0005: Static, HR-maintained FX table for reporting

**Status:** Accepted

## Context
Pay is stored in local currencies. Without conversion, HR can't answer org-wide questions such as total pay spend, or compare departments that span countries. Live FX APIs add an external dependency and numbers that change between page loads.

## Decision
Add an **`FxRate`** table (`currency → rate_to_usd`). It is seeded and **editable by HR** through `PUT /api/fx-rates/:currency`. Stored amounts stay in local currency. USD figures are **computed at query time** for reporting only. `Country.currency` has a foreign key to `FxRate`, so every currency in use has a rate.

## Consequences
- ✅ Org-wide totals and cross-country comparisons in one currency.
- ✅ Numbers are reproducible and under HR's control. No external service in the request path.
- ✅ Updating a rate immediately changes reports, and the analytics cache is invalidated.
- ❌ Rates can go stale. That's acceptable for internal comparison, and the UI shows each rate's `updated_at`.
- ❌ No historical rates: past pay is reported at today's rates. FX history would be future work.
