## Prompt 02 — Backend scaffold

Following docs/architecture.md, scaffold the backend/ app only (no domain features yet).

- backend/: Node 24 LTS + TypeScript (strict), Express, ESLint + Prettier, Vitest + Supertest.
- Structure per architecture.md §2: src/app.ts (no listen), src/server.ts, src/config (Zod-validated env),
  src/shared/{db,errors,middleware}, src/modules/ (empty for now).
- Shared pieces: AppError subclasses, central errorHandler + notFound middleware with the
  { error: { code, message, details } } shape, validate() middleware using Zod, helmet, JSON body limit.
- GET /api/health (public) returning status and uptime (DB check comes once Prisma is added).
- docker-compose.yml at repo root with PostgreSQL 16 (and Redis under an optional profile).
- backend/.env.example, npm scripts: dev, build, start, lint, format, typecheck, test.
- Tests: unit tests for errorHandler and validate middleware; API test for /api/health.
- Root README.md with a short "getting started" for the backend.

Keep it minimal; don't add dependencies the next steps don't need.