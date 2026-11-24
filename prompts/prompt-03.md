## Prompt 03 — Prisma schema, migrations & deterministic seed

Following docs/data-model.md, add the database layer to backend/.

- Add Prisma (PostgreSQL). Schema for FxRate, Country, Department, Employee, Compensation,
  CompensationComponent, User with enums (Level L1–L6, EmployeeStatus, ComponentType, Role),
  NUMERIC(14,2) money, snake_case table/column names.
- Initial migration, plus raw SQL for what Prisma can't express: CHECK (amount > 0),
  CHECK (effective_to > effective_from), partial unique index on compensation(employee_id)
  WHERE effective_to IS NULL, pg_trgm GIN index for search, and the other indexes in data-model.md.
- shared/db: a single PrismaClient instance; DATABASE_URL added to env validation;
  /api/health also checks the DB (SELECT 1) and reports it.
- Deterministic seed (fixed faker seed): 6 countries with FX rates, 8 departments,
  10,000 employees, realistic base/bonus/allowance bands by country × level,
  1–3 compensation records each (history), and the HR Manager user (credentials from env).
  Insert in batches; must be re-runnable (reset then seed) and finish in well under a minute.
- npm scripts: db:migrate, db:seed, db:reset, db:studio.
- Tests: unit tests for the pure seed generators (determinism, salary bands, non-overlapping
  history, exactly one BASE). Update README with the DB setup steps.