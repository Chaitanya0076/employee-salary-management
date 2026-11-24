# ACME Salary Management — Requirements (one-pager)

## 1. Goal
Replace ACME's spreadsheets with a deployed web app where the **HR Manager** can manage salary data for about **10,000 employees across several countries** and **answer questions about how the organisation pays people**.

**Problem today:** salary data lives in Excel files. Edits are error-prone, there is no reliable history of pay changes, and comparing pay across countries means manual work in several currencies.

## 2. In scope
| Area | Features |
|---|---|
| **Employees** | Create, view, edit, deactivate (code, name, email, country, department, job title, level, hire date, status). Server-side search, filters (country, department, level, status), sorting, pagination. **CSV export** of the filtered list. |
| **Compensation** | Effective-dated record in the employee's country currency, made of components: **Base** (exactly one), **Bonus**, **Allowance**. A pay change creates a new record, so **salary history** is kept, not overwritten. Validation: positive amounts, currency matches country, no overlapping periods. |
| **Insights** | Total pay spend org-wide and per country/department (local currency + USD); avg/median/min/max base pay by country, department and level; pay distribution buckets; headcount by country/department. |
| **Reference data** | Countries (with currency), departments, a **static FX-to-USD rate table** that HR can update. |
| **Platform** | Single HR Manager login; deterministic seed of 10,000 employees; automated tests; CI; deployment; demo video. |

## 3. Out of scope (and why)
| Item | Reason |
|---|---|
| Payroll runs, payslips | Payment execution is a different product. The ask is managing and understanding salary data. |
| Tax and statutory deductions | Country-specific, changes often, high risk to get wrong. Would take over the project. |
| Live FX rates / FX history | Static rates are enough for comparison. Live feeds add an external dependency and numbers that move between page loads. |
| Multiple roles, RBAC, SSO | The brief defines a single persona. |
| Employee self-service | Not the target persona. |
| Bulk CSV/Excel import | Needs row-level error reporting and conflict rules. Export covers the immediate need. Import is the first follow-up. |
| Approval workflows, full audit log | Org-specific process. Salary history gives traceability for the sensitive data. |
| LLM "ask a question" feature | AI is used to *build* the product. Fixed insights are more trustworthy for pay data. |
| Redis as a hard dependency | Postgres aggregates 10k rows in milliseconds. Caching stays optional and is added only after measuring. |

## 4. Tech stack and key decisions
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite, shadcn/ui + Tailwind, TanStack Query, Recharts | Internal dashboard, no SEO need. Simpler than Next.js. |
| Backend | Node.js + Express + TypeScript, Zod validation | Simple, explicit API. Modules by domain (`employees`, `compensation`, `analytics`, …), each with controller → service → repository layers. |
| Data | PostgreSQL + Prisma | Relational data, migrations, type-safe queries, aggregations in SQL. Closer to production than SQLite. |
| Money | Exact decimals + ISO currency code | No floating-point errors in pay. |
| Cache | Optional Redis behind a cache interface (in-memory/no-op by default) | Only for read-heavy insight endpoints, invalidated on pay changes. |
| Testing | Vitest (unit), Supertest (API), React Testing Library | Fast, deterministic tests focused on business rules. |
| Ops | docker-compose for local DB, GitHub Actions CI, managed Postgres + Render/Railway (API) + Vercel (web) | Low-effort, reproducible deployment. |

**Assumptions:** one currency per country; amounts are annual; FX rates are only used for reporting.

## 5. Success criteria
The HR Manager can:
1. find any employee by name or code and filter by country, department and level
2. see current pay by component, plus the full salary history
3. record a pay change with an effective date, with invalid changes rejected clearly
4. see org-wide and per-country/department pay totals in USD and averages/medians by level
5. export any filtered list to CSV

**Non-functional:** all lists paginated and aggregations done in the DB; p95 < 300 ms on the seeded data; authenticated access only, with hashed passwords and validated inputs; CI runs lint, typecheck, tests and build.

## 6. Delivery approach
Built incrementally with AI. Each step is driven by a prompt saved in `prompts/prompt-NN.md` and reviewed before it is committed:
requirements → architecture & data model → scaffold → schema & seed → auth → employees API → compensation API → insights API → web UI → optional cache → CI → deploy & docs.
