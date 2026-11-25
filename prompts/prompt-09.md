## Prompt 09 — Employees UI (list, detail, create/edit, pay changes)

Build the Employees feature in frontend/ against the existing API.

- Employees list: server-side pagination, sorting (column headers), search (debounced),
  filters (country, department, level, status) kept in the URL query string so views are
  shareable and survive reload; shows current pay (local + USD); loading skeletons, empty and
  error states; "Export CSV" downloads the current filtered view.
- Employee detail page: profile, current pay broken down by component, salary history table
  (newest first), deactivate/reactivate with confirmation.
- Create and edit employee forms (react-hook-form + zod mirroring the API rules), mapping
  server field errors onto fields; country locked when editing.
- Record pay change dialog: effective date, components (BASE required, add BONUS/ALLOWANCE),
  reason; shows the change vs current pay before submitting; success toast; refreshes detail,
  history and list queries.
- Route-level code splitting for pages.
- Tests: list URL-state sync and filters, form validation and server error mapping, pay
  change dialog happy path and 409/400 handling (mocked API).