## Prompt 06 — Compensation API (pay changes & history)

Following docs/data-model.md (rules R1–R8) and ADR-0004, add the compensation module to backend/.

- GET /api/employees/:id/compensation: current record + full history (newest first), each
  with components, total, and USD equivalents; 404 for unknown employee.
- POST /api/employees/:id/compensation: record a pay change
  { effectiveFrom, components[], reason? } in one transaction: close the current record
  (effective_to = new effective_from) and open the new one.
  - effectiveFrom must be after the current record's effective_from and not in the future (R6).
  - Exactly one BASE, unique types, positive amounts (reuse compensation.rules).
  - Currency derived from the employee's country; reject changes for INACTIVE employees.
  - Safe under concurrent requests (lock the employee's current row or rely on the
    partial unique index and map the conflict to 409).
  - Response includes the new record and the change vs. previous (absolute and % for base/total).
- Unit tests for the pay-change rules (fake repository, injected clock); integration tests
  for history order, the transaction (old record closed, new current), validation failures,
  inactive employee, and a concurrent double-submit producing exactly one new record.
- Update docs (architecture API table) if anything differs.
