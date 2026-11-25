## Prompt 11 — CI and deployment readiness

Prepare the project to be deployed and continuously checked.

- GitHub Actions (.github/workflows/ci.yml) on push and pull request:
  - backend: install, prisma generate, lint, typecheck, unit tests, integration tests against a
    Postgres 16 service container, build.
  - frontend: install, lint, typecheck, tests, build.
  - cache npm, Node 24, fail fast on errors.
- Deployment config:
  - Render blueprint (render.yaml): web service for backend/ (build, `prisma migrate deploy` on
    release, start, health check /api/health) and a managed PostgreSQL database; env vars
    (JWT_SECRET generated, TRUST_PROXY=1, NODE_ENV=production, DATABASE_URL from the DB).
  - Vercel: frontend/vercel.json rewrite to the Render API host, build settings.
  - One-off production seed command (SEED_ALLOW_PRODUCTION) documented.
- Production checks: cookie Secure + SameSite through the Vercel proxy, trust proxy, rate limit
  sees real client IPs, no secrets in the repo, .env.example files complete.
- docs/deployment.md: step-by-step deploy guide (accounts, env vars, first deploy, seeding,
  rollback) and a smoke-test checklist.
- Don't deploy anything yourself; I will create the accounts and run the deploy.