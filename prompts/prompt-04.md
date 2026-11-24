## Prompt 04 — Authentication (single HR Manager)

Following docs/architecture.md §5, add authentication to backend/.

- auth module (routes → controller → service → repository, Zod schemas):
  POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me.
- Verify password with bcryptjs; issue a JWT (HS256, 8h) in an httpOnly, SameSite=Lax cookie
  (Secure in production). JWT_SECRET (min 32 chars) and expiry added to env validation.
- requireAuth middleware: verifies the cookie, attaches the user to the request, 401 otherwise.
  Every route except /api/health and /api/auth/login is protected by default.
- Same generic error for unknown email and wrong password; rate-limit the login endpoint.
- Tests: unit tests for the auth service (fake repository, fake clock/token signer) and
  requireAuth; API tests for login success/failure, me with and without the cookie, logout,
  and rate limiting.
- Update README/.env.example; no frontend work yet.