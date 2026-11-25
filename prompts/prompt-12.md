## Prompt 12 — Final documentation and review

Make the repository ready for review. No new features in this step.

- README rewrite (the entry point for reviewers):
  - What it is and who it's for (HR Manager, ~10k employees across countries), live demo link
    (https://employee-salary-management-lovat.vercel.app) and how to get demo credentials
    (shared privately, not in the repo).
  - Feature list mapped to docs/requirements.md, with screenshots of the dashboard, employee
    list, pay-change dialog and insights (saved under docs/screenshots/).
  - Quick start for local development, how to run the tests, and the CI badge.
  - Architecture summary with links to docs/ (architecture, data model, ADRs, performance,
    deployment).
  - Key decisions and trade-offs in short form (Express vs NestJS, PostgreSQL vs SQLite,
    effective-dated salary model, static FX table, no Redis yet, same-origin /api, etc.).
  - Testing strategy: unit vs API vs integration tests, what each covers, counts.
- "How AI was used" section:
  - The prompt-driven workflow (prompts/prompt-NN.md, one per step, reviewed before running,
    incremental commits).
  - What was generated vs. reviewed and changed by hand.
  - Concrete examples of issues caught by verification rather than trusted output (query
    tuning from benchmarks, CI dry run catching formatting, production rehearsal, TRUST_PROXY
    measured on the live deploy, rejected dependency changes from the shadcn CLI).
  - Limits and how they were handled.
- docs/requirements.md: reconcile with what was built (anything added, changed or deferred,
  with reasons).
- docs/performance.md: add the production numbers from Render's free instance (insight
  endpoints ~2s vs ~100–250ms locally) and the resulting caching decision under ADR-0006.
- Security write-up (docs/architecture.md and a short README section): what is protected and
  how; known risk that X-Forwarded-For can be spoofed by calling the public Render URL
  directly, bypassing the per-IP login limit; why it is acceptable now (bcrypt cost 12,
  strong password, all data behind auth); future scope: per-account failed-login limit (and
  its lockout trade-off), Vercel-only origin, shared rate-limit store, WAF, MFA.
- Final review pass: consistency between docs and code (env vars, endpoints, numbers),
  dead code, TODOs, leftover debug output, broken links in docs.