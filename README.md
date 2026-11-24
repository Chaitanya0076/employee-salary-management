# ACME Salary Management

Web app for the HR Manager to manage salary data for about 10,000 employees across several countries, and to answer questions about how the organisation pays people.

- **Requirements:** [docs/requirements.md](docs/requirements.md)
- **Architecture:** [docs/architecture.md](docs/architecture.md) · **Data model:** [docs/data-model.md](docs/data-model.md) · **Decisions:** [docs/adr/](docs/adr/)
- **AI prompts used to build it, step by step:** [prompts/](prompts/)

## Repository layout

```
backend/    Express + TypeScript REST API
frontend/   React + Vite SPA (coming in a later step)
docs/       requirements, architecture, data model, ADRs
prompts/    prompt-NN.md, one per build step
```

## Getting started (backend)

Prerequisites: Node.js 24 LTS (`backend/.nvmrc`; run `nvm use` inside `backend/`), Docker.

```bash
# 1. Start PostgreSQL (add --profile cache to also start the optional Redis)
docker compose up -d

# 2. Install and configure the API
cd backend
npm install
cp .env.example .env

# 3. Run it
npm run dev          # http://localhost:4000/api/health
```

### Backend scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the API with reload on change |
| `npm run build` / `npm start` | Compile to `dist/` and run the compiled build |
| `npm test` | Run unit + API tests (Vitest + Supertest) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |
| `npm run format` | Format with Prettier |
