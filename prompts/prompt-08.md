## Prompt 08 — Frontend foundation (scaffold, auth, layout)

Following docs/architecture.md and ADR-0002, scaffold frontend/ as an independent app.

- Vite + React + TypeScript (strict), Tailwind + shadcn/ui, TanStack Query, React Router,
  ESLint + Prettier, Vitest + React Testing Library. Node 24 (.nvmrc).
- Vite dev proxy: /api -> http://localhost:4000 (same-origin, no CORS); vercel.json with the
  /api rewrite to the backend and SPA fallback.
- Typed API client (fetch wrapper): JSON, credentials, maps { error: { code, message, details } }
  to a typed ApiError; 401 sends the user to /login.
- Auth: login page (email/password, generic error, disabled while submitting), session from
  GET /api/auth/me, logout; protected routes redirect to /login and back after login.
- App shell: sidebar/top nav (Dashboard, Employees, Insights, Settings/FX rates), user menu,
  empty placeholder pages for now; responsive; accessible (labels, focus, keyboard).
- Shared formatting helpers: money (Intl.NumberFormat with currency), dates, numbers.
- Tests: API client error mapping, money formatting, login form behaviour, protected route redirect.
- Update README with frontend setup.