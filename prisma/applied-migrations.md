# Applied DB migrations — Neon Postgres (production)

A hand-kept ledger of every schema change applied to the production
Neon database. Necessary because `prisma migrate deploy` can't run on
the pooled URL (PgBouncer transaction-mode drops the advisory locks
Prisma needs), so every change goes through the Neon SQL console
manually.

When you make a schema change:

1. Edit `prisma/schema.prisma`.
2. Run `npx prisma format` to canonicalize.
3. Append a new dated entry below with the exact SQL you ran.
4. Paste the SQL into the Neon SQL editor (use the **direct / unpooled**
   URL — DDL on the pooled URL is also unreliable for some statements).
5. Commit the schema.prisma edit + this file in the same commit.

If you restore from backup or spin up a new DB, replay every block
below in order to reach the current schema state.

---

## 2026-05-29 — Anon-to-anon challenge flow

Added a flag for guest user accounts (created by the `/play` anon
challenge flow and converted to real accounts via `/api/auth/claim-guest`)
and relaxed the challenge `target_id` constraint so anon "open" invites
can sit on a Challenge row with no recipient set yet.

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_guest"
  BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "challenges"
  ALTER COLUMN "target_id" DROP NOT NULL;
```

Code that depends on this: `src/lib/services/guest-service.ts`,
`src/app/api/challenges/anon/route.ts`,
`src/app/api/challenges/[id]/accept-anon/route.ts`,
`src/app/api/auth/claim-guest/route.ts`.
