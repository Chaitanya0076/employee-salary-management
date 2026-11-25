# ADR-0006: Redis is optional, behind a cache interface

**Status:** Accepted. Caching designed, not yet built (see Outcome).

## Context
Salary data changes rarely, while analytics endpoints aggregate across all 10k employees and may be requested often. Redis was considered. But at this scale PostgreSQL computes these aggregates in milliseconds, and adding infrastructure before measuring would be premature.

## Decision
- Define a `Cache` interface in `shared/cache`. The default adapter is in-memory (or no-op), and a **Redis adapter is used only when `REDIS_URL` is set**.
- Cache **only analytics responses** (TTL 10 min, key = namespace + version + normalised query).
- Invalidate with a **namespace version bump** whenever employees, compensation or FX rates change.
- Build and measure the uncached baseline first. Turn caching on only if measurements in `performance.md` justify it.

## Consequences
- ✅ The app runs and deploys with only Postgres. There are no Redis failure modes by default.
- ✅ Caching lives in the service layer and is easy to test with the in-memory adapter.
- ✅ Scaling out (several API instances) only needs `REDIS_URL` set, with no code change.
- ❌ The in-memory adapter isn't shared between instances. That's fine for a single instance, and documented.
- ❌ There's a short window of stale data if invalidation is missed. Reduced by the TTL and by tests on every mutation path.

## Outcome (measured)
- **Locally**, every insight endpoint stayed under the 300 ms p95 target (a full dashboard loads in about 200 ms), so the uncached baseline was kept, as decided.
- **On Render's free tier** the same queries take about 2 s (a fraction of a CPU, a small shared Postgres). That's the CPU-bound trigger this ADR named. See [performance.md](../performance.md#production-render-free-instance).
- **Decision:** don't add the cache yet.
  - The first remedy is a paid instance (configuration, no code).
  - If caching is then still needed, start with the in-memory adapter (one instance needs no Redis) and add Redis only when scaling out.

