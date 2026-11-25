# Architecture

Derived from [requirements.md](requirements.md). The data model is in [data-model.md](data-model.md), and decisions are recorded in [adr/](adr/).

## 1. System overview

```mermaid
flowchart LR
    HR([HR Manager<br/>browser])

    subgraph Web["frontend/ — React SPA (Vercel)"]
        UI[Pages & components<br/>shadcn/ui + Tailwind + Recharts]
        Q[TanStack Query<br/>API client]
    end

    subgraph Api["backend/ — Express API (Render)"]
        MW[Middleware<br/>access log · helmet · auth · validate]
        MOD[Domain modules<br/>auth · employees · compensation<br/>analytics · reference]
        ERR[Error handler]
    end

    DB[(PostgreSQL 16<br/>managed)]

    HR --> UI --> Q
    Q -- "HTTPS /api/* (same origin via Vercel rewrite; JSON, cookie)" --> MW --> MOD
    MOD --> ERR
    MOD -- Prisma --> DB
```

- **The frontend** is a static SPA. It holds no secrets and talks to the API only over HTTP.
- **The backend** is a stateless Express app. All business rules and validation live here.
- **PostgreSQL** is the single source of truth. Aggregations run in SQL, not in Node.
- **No cache yet.** A cache for insight endpoints is designed (§7, [ADR-0006](adr/0006-redis-optional.md)) but deliberately not built; [performance.md](performance.md) records the measurements behind that decision.

In production, the frontend proxies `/api/*` to the backend through a Vercel rewrite. Browser and API then share one origin, so the auth cookie stays first-party (`SameSite=Lax`) and CORS isn't needed.

## 2. Repository layout

One Git repo, two independent apps (each with its own `package.json`, no workspace tooling):

```
employee-salary-management/
├── backend/
│   ├── prisma/                 schema.prisma, migrations/, seed/ (pure generator + runner)
│   ├── scripts/                benchmark.ts, seed-production.sh
│   ├── src/
│   │   ├── app.ts              express app (middleware + routes), no listen()
│   │   ├── server.ts           listen(), graceful shutdown
│   │   ├── container.ts        composition root: repositories + services
│   │   ├── config/             env parsing (Zod)
│   │   ├── shared/
│   │   │   ├── db/             Prisma client (pg driver adapter)
│   │   │   ├── errors/         AppError subclasses
│   │   │   ├── middleware/     validate, errorHandler, notFound, requestLogger
│   │   │   └── utils/          pagination, money, dates, csv, shared Zod schemas
│   │   └── modules/
│   │       ├── health/
│   │       ├── auth/
│   │       ├── employees/
│   │       ├── compensation/
│   │       ├── analytics/
│   │       └── reference/      countries, departments, fx-rates
│   └── tests/                  unit/, api/ (no DB), integration/ (Postgres)
├── frontend/
│   └── src/  components/ (ui/, charts/, layout/)  features/{auth,employees,insights,reference,settings}/
│             hooks/  lib/ (api client, formatting, money)  pages/  routes.tsx
├── docs/                       requirements, architecture, data model, ADRs, performance, deployment, screenshots
├── prompts/                    prompt-NN.md used to build each step
├── .github/workflows/ci.yml    CI for both apps
├── render.yaml                 Render Blueprint (API + PostgreSQL)
├── docker-compose.yml          Postgres (+ optional Redis profile) for local dev
└── README.md
```

### Backend module structure
Each module is a folder of layers. A layer exists only when it does real work (for example, `reference` doesn't need a service).

```
modules/employees/
├── employee.routes.ts       wires paths → middleware → controller
├── employee.controller.ts   HTTP only: read req, call service, send res
├── employee.service.ts      business rules, transactions
├── employee.repository.ts   Prisma queries only
├── employee.schema.ts       Zod schemas for body/query/params (+ inferred types)
└── employee.types.ts        DTOs returned to the client
```

Dependency direction: `routes → controller → service → repository → Prisma`. Services get their repositories by plain constructor/factory injection, so unit tests can pass in fakes without a database.

## 3. Request flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant R as Router + middleware
    participant C as Controller
    participant S as Service
    participant P as Repository / Prisma
    participant D as PostgreSQL

    B->>R: PATCH /api/employees/42 (cookie, JSON)
    R->>R: requireAuth (verify JWT cookie)
    R->>R: validate(params, body) with Zod
    R->>C: typed req
    C->>S: updateEmployee(42, dto)
    S->>P: findById / update (in transaction if multi-step)
    P->>D: SQL
    D-->>P: rows
    P-->>S: entity
    S-->>C: DTO
    C-->>B: 200 JSON
    Note over R,C: Any thrown error goes to errorHandler
```

## 4. Validation and error handling
- **Validation at the edge:** `validate({ params, query, body })` middleware parses requests with Zod schemas. Controllers receive already-typed, coerced data.
- **Business rules in services:** for example "no overlapping compensation periods" or "currency must match country". Services throw typed errors.
- **Errors:** an `AppError` base class with subclasses `ValidationError` (400), `UnauthorizedError` (401), `NotFoundError` (404) and `ConflictError` (409). Known Prisma errors are mapped (unique violation → 409, record not found → 404).
- **One central `errorHandler`** returns one shape:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Base component is required", "details": [ ... ] } }
  ```
  Unknown errors are logged and returned as a generic 500. Stack traces are never sent to the client.

## 5. Authentication
- A single seeded **HR Manager** user. Passwords are hashed with **bcrypt** (cost 12).
- `POST /api/auth/login` checks credentials and sets a **JWT** (HS256, `JWT_SECRET`, 8h expiry) in an `httpOnly`, `Secure` (in production), `SameSite=Lax` cookie. The token is never readable by JS.
- **Protected by default:** public routes (`/api/health`, `/api/auth/login`, `/api/auth/logout`) are mounted first, then the `requireAuth` guard, then every other router. New modules are protected automatically. Unauthenticated requests to unknown routes get 401 rather than 404, so the route list isn't revealed.
- Logout only clears the cookie, so it stays public: a user whose session has already expired can still log out cleanly.
- Hardening, all cheap: `helmet`; login rate limit (10 **failed** attempts per IP per 15 min, so successful logins don't count); a JSON-only body parser with a size limit; the same generic message **and timing** for wrong email or wrong password (an unknown email is still compared against a dummy bcrypt hash); the user is re-read on every request so a deleted account loses access immediately.
- The rate limiter keeps its counts in memory (per instance). That's fine for one instance; a shared store (e.g. Redis) would be needed when scaling out.
- No RBAC: there is one role (`HR_MANAGER`), stored on the user so it can be extended later.

## 6. API endpoints
All endpoints are under `/api`, return JSON unless noted, and require auth unless marked public.

**List conventions:** `page` (default 1), `pageSize` (default 25, max 100), `sort=field:asc|desc`. The response is `{ data: [...], meta: { page, pageSize, total, totalPages } }`. Unknown query parameters are rejected (400), so a typo never silently returns everything. Reference lists return `{ data: [...] }`.

**Money in JSON** is always an exact decimal string with 2 places (`"120000.00"`); FX rates have 8 places. Dates are `YYYY-MM-DD`.

| Method | Path | Purpose | Query / body |
|---|---|---|---|
| GET | `/health` | Liveness + DB check (public) | – |
| POST | `/auth/login` | Log in, set cookie (public) | `{ email, password }` |
| POST | `/auth/logout` | Clear cookie (public) | – |
| GET | `/auth/me` | Current user | – |
| GET | `/employees` | Paginated list; each row has `pay { currency, base, total, baseUsd, totalUsd }` | `page, pageSize, sort` (`name`, `employeeCode`, `hireDate`, `baseSalary`, `totalUsd`), `q` (substring of name/email/code), `country`, `department`, `level`, `status` |
| GET | `/employees/export` | CSV of the filtered list (`text/csv`, UTF-8 BOM for Excel, formula-injection safe, streamed in chunks) | same filters and sort as the list, no pagination |
| GET | `/employees/:id` | Employee details + current compensation | – |
| POST | `/employees` | Create an employee **with** initial compensation (one transaction). Code (`EMP-#####`) and currency are derived; pay starts on the hire date | employee fields + `compensation { components[] }` |
| PATCH | `/employees/:id` | Update employee fields, including `status` (deactivate/reactivate). Country can't change (pay history is in its currency) | partial employee fields |
| GET | `/employees/:id/compensation` | `{ employeeId, currency, current, history }`: `history` is every record newest first (current included), each with components, totals and USD equivalents (at today's FX rate) | – |
| POST | `/employees/:id/compensation` | Record a pay change: in one transaction, lock the current record, close it at `effectiveFrom`, open the new one. Returns `{ compensation, previous, change: { base, total } }` (absolute and % change). 400 for a bad date or identical pay; 409 for an inactive employee or a concurrent change | `{ effectiveFrom, components: [{ type, amount }], reason? }` |
| GET | `/analytics/summary` | `{ headcount, currency: "USD", totalPay, averagePay, medianPay }` (total compensation) | `country?`, `department?` |
| GET | `/analytics/by-country` | `{ data }` per country, largest USD spend first: headcount, `totalPay` (local) + `totalPayUsd`, base `{ average, median, min, max }` in local currency | `department?` |
| GET | `/analytics/by-department` | `{ currency: "USD", data }` per department: headcount, `totalPayUsd`, base `{ average, median }` in USD | `country?` |
| GET | `/analytics/by-level` | `{ currency, data }` per level: headcount, base stats (local currency when `country` is given, otherwise USD) | `country?`, `department?` |
| GET | `/analytics/distribution` | `{ currency, data: [{ from, to, count }] }`: base-pay histogram with readable edges (steps of 1/2/2.5/5 × 10ⁿ), at most `buckets` buckets; last bucket includes its upper edge | `country?`, `department?`, `level?`, `buckets` (2–50, default 10) |
| GET | `/analytics/headcount-trend` | `{ data: [{ year, hires, cumulative }] }`: hires per year of today's active employees (years without hires included). There's no termination date in the model, so this shows how the current workforce was built up, not historical headcount | `country?`, `department?` |
| GET | `/countries` | Countries with currency | – |
| GET | `/departments` | Departments | – |
| GET | `/fx-rates` | Static FX-to-USD rates | – |
| PUT | `/fx-rates/:currency` | Update one rate (USD is fixed at 1); USD figures everywhere use it immediately | `{ rateToUsd }` |

Insight endpoints reject unknown country/department values with 400 rather than returning empty results. Medians use `percentile_cont(0.5)` (the two middle values are averaged for even counts).

Sorting by `baseSalary` or `totalUsd` uses the **USD equivalent**, so the order is meaningful across currencies. Within one country it matches the local-amount order.

Analytics only count **ACTIVE** employees and their **current** compensation.

## 7. Caching (designed, not built)
Not implemented, on purpose ([ADR-0006](adr/0006-redis-optional.md)). On a laptop every insight endpoint answers in about 100–250 ms. On Render's free instance (a fraction of one CPU) they take about 2 s, which is the trigger ADR-0006 names. The numbers and the decision are in [performance.md](performance.md). If it's added, the design is:
- a `Cache { get, set(key, value, ttl), invalidate(namespace) }` interface: in-memory by default, Redis when `REDIS_URL` is set
- only `analytics/*` responses are cached; the key is namespace + version + normalised query; TTL 10 minutes
- writes to employees, compensation or FX rates bump the `analytics` namespace version, invalidating every entry in one step

## 8. Testing approach
386 tests in total, all deterministic: fixed seed data, no network calls, an injected clock for "today".

| Suite | Count | What it covers |
|---|---:|---|
| Backend unit (Vitest) | 179 | Services with fake repositories: compensation and pay-change rules, auth and tokens, query/sort parsing, SQL builders, money and FX maths, CSV escaping, bucket planning, env and seed config, request logging |
| Backend API, no database (Supertest) | 18 | `createApp()` with fake services: health, auth flow, cookie flags, rate limiting (incl. behind proxies), error shapes |
| Backend integration (Supertest + Postgres) | 82 | Real services from `src/container.ts` against a separate `salary_management_test` database (created and migrated by a Vitest global setup; hand-written fixtures with known values): filters, sorting, pagination, export, create/update, pay changes incl. a concurrent double-submit, insights with hand-computed expected values |
| Frontend (Vitest + React Testing Library) | 107 | The real app routes with a mocked API: login and protected routes, list URL state, filters, search debounce, forms and server-error mapping, pay-change dialog, dashboard, insights currency rule, FX editing |

CI runs all of them on every push and pull request (`.github/workflows/ci.yml`).

## 9. Configuration and operations
- Access log: one JSON line per request (method, path without the query string, status, duration, client IP), skipped in tests.
- Deployment (Render + Vercel), CI and rollback: [deployment.md](deployment.md).

Env vars are validated at startup with Zod, so the app fails fast on bad config:
- backend: `DATABASE_URL`, `JWT_SECRET` (≥ 32 chars; the example placeholder is refused in production), `JWT_TTL_MINUTES` (default 480), `TRUST_PROXY` (number of proxies in front of the API, so rate limiting sees real client IPs; `4` in production: Vercel, Cloudflare and Render, measured as in [deployment.md](deployment.md)), `LOG_FORWARDED_FOR` (adds the raw `X-Forwarded-For` chain to access logs while calibrating), `PORT`, `NODE_ENV`
- No CORS configuration: `/api` is same-origin in both environments (Vite dev-server proxy locally, Vercel rewrite in production).
- frontend: `VITE_API_BASE_URL` (defaults to `/api`)

## 10. Security
**What is protected, and how**
- **Authentication on everything except health, login and logout.** The guard sits in front of all other routers, so new modules are protected by default. Session tokens are signed (HS256) and checked on every request, and the user is re-read so a deleted account loses access immediately.
- **Session cookie:** `HttpOnly` (no JavaScript access), `Secure` in production, `SameSite=Lax`, `Path=/api`. Because the browser only talks to the Vercel origin, the cookie is first-party and there is no CORS configuration to get wrong.
- **Passwords:** bcrypt with cost 12. A wrong password and an unknown email get the same message and take the same time (unknown emails are checked against a dummy hash).
- **Input:** every request part is validated with strict Zod schemas (unknown fields rejected); SQL values are always bound parameters; CSV export neutralises spreadsheet formulas.
- **Errors:** clients get a fixed error shape. Stack traces and database messages never leave the server.
- **Headers:** `helmet` on the API; on the frontend, a strict Content-Security-Policy (`script-src 'self'`), `X-Frame-Options: DENY`, `nosniff`, Referrer and Permissions policies.
- **Secrets:** none in the repo or its history (checked). `JWT_SECRET` is generated by Render and must be at least 32 characters; the example value is refused in production. The production seed refuses the example password and requires an explicit opt-in.
- **Login rate limit:** 10 failed attempts per client IP per 15 minutes. The client IP is resolved through the measured proxy chain (`TRUST_PROXY=4`).

**Known risk (accepted for now)**
- The Render URL is publicly reachable. A request sent straight to it, bypassing Vercel, can prepend fake `X-Forwarded-For` entries and choose its own apparent IP, which gets around the per-IP login limit.
- **Why it's acceptable today:** all data sits behind authentication; bcrypt at cost 12 makes every guess expensive; and the HR password is at least 12 characters and chosen by a person, so guessing it isn't practical.

**Future scope**
1. **Per-account failed-login limit** (e.g. 10 failures per email per 15 minutes) alongside the per-IP one. Spoofed IPs then stop helping. Trade-off: an attacker could lock the HR Manager out of *new* logins for the window (existing sessions keep working). Bounded lockout is preferable to unlimited guessing.
2. **Accept only traffic that comes through Vercel**, e.g. a secret header added by Vercel routing middleware and required by the API, so the Render URL is useless on its own.
3. **Shared rate-limit store** (Redis). Counters are in memory per instance today: fine for one instance, wrong once there are several.
4. **Network-level protection** (WAF, bot and DDoS protection) for volumetric attacks.
5. **MFA for the HR account**, and alerts on repeated failed logins.

