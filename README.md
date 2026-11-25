# ACME Salary Management

Web app for the HR Manager to manage salary data for about 10,000 employees across several countries, and to answer questions about how the organisation pays people.

- **Requirements:** [docs/requirements.md](docs/requirements.md)
- **Architecture:** [docs/architecture.md](docs/architecture.md) · **Data model:** [docs/data-model.md](docs/data-model.md) · **Decisions:** [docs/adr/](docs/adr/) · **Performance:** [docs/performance.md](docs/performance.md)
- **AI prompts used to build it, step by step:** [prompts/](prompts/)

## Repository layout

```
backend/    Express + TypeScript REST API
frontend/   React + Vite SPA
docs/       requirements, architecture, data model, ADRs
prompts/    prompt-NN.md, one per build step
```

## Getting started (backend)

Prerequisites: Node.js 24 LTS (`backend/.nvmrc`; run `nvm use` inside `backend/`), Docker.

```bash
# 1. Start PostgreSQL (add --profile cache to also start the optional Redis)
docker compose up -d

# 2. Install and configure the API (npm install also generates the Prisma client)
cd backend
npm install
cp .env.example .env

# 3. Create the schema and load demo data (10,000 employees, about 20 s)
npm run db:migrate
npm run db:seed

# 4. Run it
npm run dev          # http://localhost:4000/api/health
```

The seed is deterministic (fixed faker seed and reference date) and re-runnable: it wipes all tables and reloads the same data. It also creates the HR Manager login from `SEED_HR_EMAIL` / `SEED_HR_PASSWORD` in `.env`.

## Getting started (frontend)

The frontend is an independent Vite + React app. In development the Vite server proxies `/api` to the backend on `http://localhost:4000`, so the browser only talks to one origin and the session cookie just works (no CORS).

```bash
# with the backend running (see above)
cd frontend
nvm use                # Node 24
npm install
npm run dev            # http://localhost:5173 (sign in with SEED_HR_EMAIL / SEED_HR_PASSWORD)
```

Set `API_PROXY_TARGET` to proxy to a different backend URL. In production, `frontend/vercel.json` rewrites `/api/*` to the deployed API (the host is filled in during deployment) and falls back to `index.html` for client-side routes.

### Frontend scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with the `/api` proxy |
| `npm run build` / `npm run preview` | Type-check and build to `dist/`, then serve the build locally |
| `npm test` | Component and unit tests (Vitest + React Testing Library, jsdom) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |
| `npm run format` | Format with Prettier |

### Authentication

The API has a single HR Manager login (seeded from `SEED_HR_EMAIL` / `SEED_HR_PASSWORD`). Logging in sets an httpOnly session cookie; every endpoint except health, login and logout requires it.

```bash
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"hr.manager@acme.example","password":"<SEED_HR_PASSWORD>"}' \
  http://localhost:4000/api/auth/login
curl -b cookies.txt http://localhost:4000/api/auth/me
curl -b cookies.txt -X POST http://localhost:4000/api/auth/logout
```

### Backend scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the API with reload on change |
| `npm run build` / `npm start` | Compile to `dist/` and run the compiled build |
| `npm test` | Run all tests (needs Postgres running: `docker compose up -d`) |
| `npm run test:unit` | Unit + API tests with fake services (no database needed) |
| `npm run test:integration` | API tests against a real `salary_management_test` database (created and migrated automatically) |
| `npm run bench` | Measure API latency against a running server; see [docs/performance.md](docs/performance.md) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |
| `npm run format` | Format with Prettier |
| `npm run db:migrate` | Apply migrations in development (`prisma migrate dev`) |
| `npm run db:deploy` | Apply migrations in CI/production (`prisma migrate deploy`) |
| `npm run db:seed` | Wipe and reload the deterministic demo data |
| `npm run db:reset` | Drop the database, re-apply all migrations, then seed |
| `npm run db:generate` | Regenerate the Prisma client after editing `schema.prisma` |
| `npm run db:studio` | Browse the data in Prisma Studio |
