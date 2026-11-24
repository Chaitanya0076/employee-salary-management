# ADR-0003: Express backend organised by domain modules

**Status:** Accepted

## Context
We need a backend that's quick to build, easy for a reviewer to navigate, and testable. The options were global layer folders (`controllers/`, `services/`, …), a framework like NestJS, or domain modules on plain Express.

## Decision
Use **Express + TypeScript** with **modules per domain** (`auth`, `employees`, `compensation`, `analytics`, `reference`). Inside each module the layers are **routes → controller → service → repository**, plus a Zod **schema** file. Layers are created only where they add value (`reference` has no service). Cross-cutting code lives in `shared/` (db, cache, errors, middleware).

## Consequences
- ✅ Everything about a domain lives in one folder, so it's easy to find and change.
- ✅ Controllers handle HTTP only, services hold business rules, and repositories hold Prisma queries. Services can be unit-tested with fake repositories.
- ✅ Less ceremony than NestJS (decorators, DI container) for an app of this size.
- ❌ Express doesn't enforce the structure. It depends on conventions, which are documented in architecture.md.
- ❌ Dependency wiring is manual (small factory functions). Fine at this size.
