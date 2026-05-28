@AGENTS.md

# Project context

This is the **Next.js port of the existing Python/Flask app** at
`C:\Repo\debatethis`. The Python app is the running fallback at
[debatethisnow.com](https://debatethisnow.com); cutover happens only after
this app reaches parity.

Before doing anything substantial, read:

1. `MIGRATION_PARITY.md` — the master checklist. Routes, sockets, services,
   pages, security, deploy, env vars. Every checkbox there must be ticked
   before sign-off.
2. `MIGRATION_UI_INVENTORY.md` — every JS file, template, and CSS token
   from the existing UI. Source of truth for what each React component
   must do.

## Tech stack (locked)

- **Next.js 16** App Router (the prompt said "Next 15"; create-next-app
  installed 16. Documented in MIGRATION_PARITY.md § Deviations.)
- React 19, TypeScript strict + `noUncheckedIndexedAccess`
- Custom server: `server.ts` co-hosts Next + Socket.IO on one port,
  run via `tsx server.ts` (dev + prod)
- Prisma 7 against the existing Neon Postgres
- Auth.js v5 beta (Credentials + Google/GitHub/Twitter) with cookie names
  overridden to match Python (`dt_access`, `dt_refresh`, `dt_csrf_access`)
- TanStack Query, Zustand, Zod, bcryptjs
- Tailwind 4 + shadcn/ui (to be initialized in Phase 1)
- Vitest + Playwright

## Hard "do not"s (inherited from the mission prompt)

- Don't modify the Python codebase at `C:\Repo\debatethis`. It's the
  fallback.
- Don't change the Postgres schema. New tables only in Phase 9.
- Don't change the JWT secret, cookie names, or domain — cross-app cookie
  compat depends on it.
- Don't redesign protocols. Same REST URLs, same Socket.IO event names +
  payloads as Python.
- Don't use `any` without a comment explaining why.
- Don't add `useEffect + fetch` for data fetching — TanStack Query for
  every fetched list.

## Style notes

- Snake_case in Prisma model fields (matches DB; preserves API JSON
  shapes that the Python app emits + master_test.py expects).
- Comments explain WHY, never WHAT. Mirror the existing Python codebase's
  comment style.
- No emojis in code or commits unless I explicitly ask.

## Where to find things

- `prisma/schema.prisma` — DB schema
- `src/lib/db.ts` — Prisma singleton + statement_timeout middleware
- `src/lib/services/` (Phase 2) — port of `app/services/`
- `src/app/api/` (Phase 3) — REST routes
- `src/lib/sockets/` (Phase 4) — Socket.IO handlers, mounted from `server.ts`
- `src/app/` — pages (Phase 5)
- `proxy.ts` (Phase 1) — security headers + CSRF
