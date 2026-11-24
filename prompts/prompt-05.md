## Prompt 05 — Employees API

Following docs/architecture.md §6 and docs/data-model.md, add the employees and reference
modules to backend/ (all routes protected).

- reference module: GET /api/countries, GET /api/departments, GET /api/fx-rates,
  PUT /api/fx-rates/:currency (update rate_to_usd).
- employees module (routes → controller → service → repository, Zod schemas):
  - GET /api/employees: pagination (page, pageSize ≤ 100), sort (name, employeeCode, hireDate,
    baseSalary, totalUsd; asc/desc), filters (q, country, department, level, status).
    Each row includes current pay summary: currency, base, total, totalUsd.
    q must use the same expression as the pg_trgm index.
  - GET /api/employees/export: CSV of the same filtered list (streamed, no pagination,
    safe against CSV formula injection).
  - GET /api/employees/:id: details + current compensation with components.
  - POST /api/employees: create employee with initial compensation in one transaction
    (currency derived from country, exactly one BASE, positive amounts).
  - PATCH /api/employees/:id: update fields incl. status (deactivate/reactivate);
    changing country is not allowed once compensation exists (would break currency rule).
- Map Prisma unique violations (email) to 409.
- Tests: unit tests for the service rules and query/sort parsing (fake repository),
  CSV escaping; API tests against a real Postgres test database for list filters, sorting,
  pagination, export, create/update validation and 404/409 cases.
- Measure the list/export endpoints on the 10k dataset and note timings for performance.md later.
