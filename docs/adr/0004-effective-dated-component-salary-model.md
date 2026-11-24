# ADR-0004: Effective-dated, component-based salary model

**Status:** Accepted

## Context
Employees are in several countries, and pay is made of more than a base salary. HR needs to see current pay, its breakdown, and how it changed over time. In the spreadsheets, edits overwrite history.

## Decision
- Pay is a **`Compensation`** record per employee with `effective_from` / `effective_to` (exclusive end; `NULL` = current) and a `currency`.
- A record has **`CompensationComponent`** rows typed `BASE` (exactly one), `BONUS` and `ALLOWANCE`. Amounts are `NUMERIC(14,2)` and annual.
- A pay change **appends** a new record and closes the previous one in a single transaction. Existing records are never edited.
- Currency is derived from the employee's country, never accepted from the client.
- v1 only allows pay changes effective today or earlier, so "open-ended record" always means "current".

## Consequences
- ✅ Full salary history comes for free, and analytics can break pay down by component.
- ✅ New component types (e.g. `EQUITY`) are an enum change, not a schema redesign.
- ✅ Exact decimal money: no float rounding errors.
- ❌ Reading current pay needs a join (kept fast by the partial unique index on `effective_to IS NULL`).
- ❌ Future-dated raises aren't supported yet. Supporting them means defining "current" as of a date and adding a scheduled view.
