## Prompt 01 — Architecture & data model

Based on docs/requirements.md, design the architecture and data model before writing any app code.

Produce:
1. docs/architecture.md
   - System diagram (Mermaid): React SPA → Express API → PostgreSQL, optional Redis.
   - Repository layout: single Git repo with independent backend/ and frontend/ apps (each with its own package.json; no workspace tooling), plus docs/ and prompts/. Backend module structure (employees, compensation, analytics, reference, auth; controller → service → repository → schema).
   - Request flow, error-handling and validation approach, auth approach (single HR user, JWT in httpOnly cookie).
   - API endpoint list (method, path, purpose, query params for pagination/filter/sort).
2. docs/data-model.md
   - ER diagram (Mermaid) and table descriptions for: Country (with currency), Department,
     Employee, Compensation (effective_from/effective_to, currency), CompensationComponent
     (BASE/BONUS/ALLOWANCE, exact decimal amount), FxRate (currency → USD), User.
   - Business rules: exactly one BASE per compensation, positive amounts, currency matches
     employee country, no overlapping effective periods, current pay = open-ended record.
   - Indexes needed for search/filter/analytics at 10k employees.
3. docs/adr/ — short Architecture Decision Records (context, decision, consequences) for:
   PostgreSQL over SQLite, React+Vite over Next.js, modular Express, component-based
   effective-dated salary model, static FX table, Redis as optional.

Keep it concise and practical: no over-engineering, nothing beyond what the requirements need.
Don't write application code in this step.
