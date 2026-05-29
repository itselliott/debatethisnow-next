@AGENTS.md

# Project context

DebateThis is a Next.js 16 app — 1v1 timed debates, audience voting, real
Elo, AI bot opponents, social graph, achievements. Deployed to Fly.io as
`debatethisnow-next`, production domain `debatethisnow.com`.

The codebase was originally a port from a Flask app, but the Python
project is retired and removed — this repo is the only source of truth
for the product. Migration-era docs (`MIGRATION_PARITY.md`,
`MIGRATION_UI_INVENTORY.md`) are historical only; useful for context on
why things are shaped the way they are, but not authoritative.

## Tech stack

- **Next.js 16** App Router, React 19, TypeScript strict +
  `noUncheckedIndexedAccess`
- Custom server: `server.ts` co-hosts Next + Socket.IO on one port,
  run via `tsx server.ts` (dev + prod)
- Prisma against Neon Postgres
- Auth: JWT in HttpOnly cookies (`dt_access`, `dt_refresh`,
  `dt_csrf_access`), Credentials + Google/GitHub/Twitter OAuth, magic
  links via Postmark
- TanStack Query, Zustand, Zod, bcryptjs
- Tailwind 4 with `@theme inline` tokens
- Vitest + Playwright

## Hard "do not"s

- Don't change the JWT secret or cookie names unless you also clear
  every active session — there's no graceful rotation path today.
- Don't run `prisma migrate deploy` from CI or the release_command.
  Neon's pooled URL (PgBouncer transaction mode) drops the advisory
  locks Prisma needs and the deploy will crash-loop. Schema changes go
  through the Neon SQL console using a `DIRECT_URL`-style unpooled
  endpoint; record every change in `prisma/applied-migrations.md`
  (create this file the first time you do it).
- Don't use `any` without a comment explaining why.
- Don't add `useEffect + fetch` for data fetching — TanStack Query for
  every fetched list.

## Style notes

- Snake_case in Prisma model fields (matches existing DB column names).
  Changing to camelCase would force a translation layer on every API
  response.
- Comments explain WHY, never WHAT.
- No emojis in code or commits unless I explicitly ask.

## Where to find things

- `prisma/schema.prisma` — DB schema
- `src/lib/db.ts` — Prisma singleton + statement_timeout middleware
- `src/lib/services/` — domain services (matchmaking, debate, scoring,
  notifications, guest accounts, etc.)
- `src/app/api/` — REST routes
- `src/lib/sockets/` — Socket.IO handlers, mounted from `server.ts`
- `src/app/` — pages
- `proxy.ts` — security headers + CSRF middleware
- `content/blog/` — Markdown blog corpus
- `src/lib/topics/catalog.ts` — 300+ stock debate topics
