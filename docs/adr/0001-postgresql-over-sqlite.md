# ADR-0001: PostgreSQL (via Prisma) over SQLite

**Status:** Accepted

## Context
The brief allows "a relational database of your choice, like SQLite". The app must be **deployed**, hold 10k employees with salary history, and answer aggregate questions (medians, distributions, group-bys).

## Decision
Use **PostgreSQL** with **Prisma** as the ORM and migration tool. Run Postgres locally through docker-compose, and use a managed Postgres instance in production.

## Consequences
- ✅ Analytics in SQL: `percentile_cont` (median), `width_bucket` (histograms), `FILTER`, window functions.
- ✅ Real constraints: partial unique indexes, CHECKs, `pg_trgm` for substring search.
- ✅ Persistent storage on free PaaS hosts (SQLite files are lost on ephemeral container disks).
- ✅ Prisma gives typed queries, migrations and a seed workflow. Complex aggregates use `$queryRaw` with bound parameters.
- ❌ Local setup needs Docker (one `docker compose up`).
- ❌ Tests that touch the DB need a Postgres test instance. Unit tests avoid this by faking repositories.
