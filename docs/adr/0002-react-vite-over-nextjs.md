# ADR-0002: React + Vite SPA over Next.js

**Status:** Accepted

## Context
The UI is an authenticated internal dashboard for one HR persona. Nothing needs SEO, and nothing benefits from server rendering. The brief allows React or Next.js.

## Decision
Build a **client-side SPA with React + TypeScript + Vite**, using shadcn/ui + Tailwind for components and TanStack Query for server state. Deploy it as static files (Vercel). `/api/*` is proxied to the Express backend.

## Consequences
- ✅ Clear separation: the frontend talks to the backend only over HTTP, and the backend owns all logic.
- ✅ Fewer concepts than Next.js (no SSR/RSC, server actions or API routes duplicating the backend).
- ✅ Fast dev server and simple static deployment.
- ❌ No SSR. That's acceptable here: first load sits behind a login, and SEO doesn't matter.
- ❌ Client-side routing needs the host to fall back to `index.html` (a one-line Vercel config).
