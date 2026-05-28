# DebateThis — Python → Next.js Migration Parity Matrix

Authoritative checklist for the rewrite at `C:\Repo\debatethisnow-next`.
Every line item in this document must be satisfied before DNS cutover from
the existing Python app (`C:\Repo\debatethis`, deployed at
`debatethisnow.com`) to the new Next.js app.

**Source of truth for cross-references**
- Python repo root: `C:\Repo\debatethis`
- Next.js repo root: `C:\Repo\debatethisnow-next`
- Path format below: `path/relative/to/repo-root.py`

## Status legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| 🟡 | In progress |
| ✅ | Implemented + verified against Python parity |
| ⏸ | Deferred to a later phase (Phase 9 new features) |
| ❌ | Decided NOT to port (justification required next to the row) |

## Deviations from the mission prompt (with written reason, per the prompt's rule)

| Deviation | Reason |
|-----------|--------|
| **Next.js 16.2.6 instead of "Next.js 15"** | `create-next-app@latest` installed Next 16 (released between the mission prompt and execution). The prompt's intent — App Router + React 19 + TS strict — is satisfied. Net wins: pages dynamic by default (matches our needs; almost nothing in this app is statically cacheable except blog + legal pages), `proxy.ts` replaces deprecated `middleware.ts`. Net trade-off: training-data drift on file conventions — consult `node_modules/next/dist/docs/` before writing speculative code (the in-tree `AGENTS.md` warns about this explicitly). |
| **`proxy.ts` instead of `middleware.ts`** | Next 16 deprecated `middleware.ts` in favor of `proxy.ts`. Same purpose (security headers, CSRF, X-Robots-Tag), new file convention. All `middleware.ts` references in this document refer to `proxy.ts` going forward. |
| **`tsx server.ts` for dev + prod** | The mission prompt said "Next.js dev + prod both run through `node server.ts`." `node server.ts` would require pre-compiling TypeScript; `tsx server.ts` runs it directly with no build step. `tsx` is small (~1MB), stable, and matches the Python app's no-build deploy ergonomics. |
| **`turbopack: false` in the custom server** | Turbopack's custom-server integration (HMR + standalone output tracing) is still maturing in Next 16. Webpack is the safer default for a launch-bound rewrite. Revisit once Turbopack reaches GA for custom servers. |
| **`prisma/schema.prisma` hand-authored before `db pull`** | DATABASE_URL isn't available to this session yet. Schema mirrors the Python models 1:1 (snake_case fields, exact column types, indexes, FKs). Running `npm run db:pull` against the real Neon URL will validate (and refine, if there's drift). |
| **Custom JWT signing for credentials, Auth.js reserved for OAuth only** | The cookie cross-compat constraint requires the Next-app-issued JWT to verify byte-for-byte on the running Python app. Auth.js v5's default session JWT format is JWE-encrypted with its own claim shape; making it match flask-jwt-extended would require disabling the encryption and rewriting the claim-shape callback — at which point we're not really using Auth.js anymore. We implement JWT signing with `jose` (same HS256 + JWT_SECRET_KEY as Python), set the `dt_access` / `dt_refresh` / `dt_csrf_access` / `dt_csrf_refresh` cookies ourselves, and reserve Auth.js for the OAuth provider dance in Phase 3 (`signIn` callback completes the upstream code exchange, then our code mints the Python-compat cookies). This still uses Auth.js for "what it's good at" while satisfying the cookie-compat hard requirement. |

## Locked architectural decisions (do not re-debate)

1. **Database schema is frozen.** `prisma db pull` from the existing Neon URL
   produces `schema.prisma`; we commit that file as-is. New tables only when
   explicitly listed in Phase 9.
2. **bcrypt password hashes preserved.** New app uses `bcryptjs.compare()`
   against the existing `password_hash` column.
3. **JWT secret preserved.** `JWT_SECRET_KEY` carries over. Tokens issued by
   the Python app stay valid on the Next.js app during cutover.
4. **Cookie names match.** `dt_access`, `dt_refresh`, `dt_csrf_access`,
   `dt_csrf_refresh`. Same domain (`.debatethisnow.com`), same
   `SameSite=Lax`, same `httpOnly+Secure` in prod.
5. **Socket.IO event names + payloads match exactly** — see § Socket events.
6. **API route paths + JSON shapes match exactly** — see § HTTP routes.
7. **Same Neon Postgres database, same Fly secrets, single Node process.**

---

## 1. Database schema → Prisma model mapping

`prisma db pull` will introspect the live Neon DB. The table below is the
expected output and the canonical Python source for each model. Use this to
double-check no model gets dropped during introspection.

| Table | Python model | Key columns | Notes for Prisma |
|-------|--------------|-------------|------------------|
| `users` | [app/models/user.py](../debatethis/app/models/user.py) | id, username (uniq), email (uniq), password_hash, elo_rating, wins, losses, debates_completed, avatar, rank_tier, online_status, is_admin, is_banned, is_bot, owner_id (FK self), api_key (uniq), bot_description, created_at, last_seen_at, username_changes | `online_status` is `online`/`in_queue`/`in_debate`/`offline`. `username_changes` stores JSON-encoded ISO timestamp list (NOT a relation). |
| `debates` | [app/models/debate.py](../debatethis/app/models/debate.py) | id, topic, category, status, player1_id, player2_id, winner_id, side_player1, side_player2, current_round, current_turn_user_id, phase, is_prep, turn_started_at, turn_deadline, score_player1, score_player2, ai_score_player1, ai_score_player2, votes_player1, votes_player2, elo_delta_player1, elo_delta_player2, created_at, started_at, completed_at | `status`: pending/live/voting/completed/abandoned. `phase`: opening/rebuttal/closing/judging/done. |
| `debate_messages` | [app/models/debate_message.py](../debatethis/app/models/debate_message.py) | id, debate_id, author_id, round_number, phase, content, word_count, created_at | content is unbounded TEXT — Next enforces max bytes at the route level. |
| `debate_votes` | [app/models/debate_vote.py](../debatethis/app/models/debate_vote.py) | id, debate_id, voter_id, vote_for, voter_ip_hash, created_at | UNIQUE(debate_id, voter_id). voter_ip_hash is salted SHA-256 for sockpuppet dedup. |
| `debate_results` | [app/models/debate_result.py](../debatethis/app/models/debate_result.py) | id, debate_id (uniq), winner_id, loser_id, final_score_player1, final_score_player2, ai_score_player1, ai_score_player2, votes_player1, votes_player2, elo_change_winner, elo_change_loser, summary, created_at | |
| `matchmaking_queue` | [app/models/matchmaking_queue.py](../debatethis/app/models/matchmaking_queue.py) | id, user_id (uniq), preferred_topic, preferred_category, elo_snapshot, socket_sid, joined_at | One row per actively-queued user. |
| `user_stats` | [app/models/user_stats.py](../debatethis/app/models/user_stats.py) | id, user_id (uniq), peak_elo, avg_words_per_argument, longest_win_streak, current_streak, total_arguments, total_audience_votes, favorite_category, updated_at | 1:1 with users. |
| `achievements` | [app/models/achievement.py](../debatethis/app/models/achievement.py) | code (PK string), name, description, icon, tier | Catalog table seeded on first boot. |
| `user_achievements` | [app/models/achievement.py](../debatethis/app/models/achievement.py) | id, user_id, code, awarded_at, debate_id | UNIQUE(user_id, code). |
| `app_settings` | [app/models/app_setting.py](../debatethis/app/models/app_setting.py) | key (PK), value, updated_at | Generic KV store. Used for `bot_model`, `llm_scorer_enabled`, `llm_scorer_model`, `daily_topic`, `daily_topic_category`, `daily_topic_set_at`. |
| `reports` | [app/models/report.py](../debatethis/app/models/report.py) | id, reporter_id, target_user_id, debate_id, message_id, reason, note, status, created_at, resolved_at | reason: harassment/hate/spam/off_topic/threats/cheating/other. status: pending/dismissed/actioned. |
| `challenges` | [app/models/challenge.py](../debatethis/app/models/challenge.py) | id, challenger_id, target_id, topic, category, note, status, debate_id, created_at, expires_at (default +7d), accepted_at | status: pending/accepted/declined/expired/started. |
| `friendships` | [app/models/friendship.py](../debatethis/app/models/friendship.py) | id, requester_id, target_id, status, created_at, accepted_at | UNIQUE(requester_id, target_id). Single row represents both directions when accepted. status: pending/accepted/blocked. |
| `notifications` | [app/models/notification.py](../debatethis/app/models/notification.py) | id (BigInt PG / Int SQLite), user_id, kind, payload (JSONB PG / JSON SQLite), read_at, created_at | Composite index `(user_id, read_at, created_at)`. Kinds documented in notification_service. |
| `user_settings` | [app/models/user_settings.py](../debatethis/app/models/user_settings.py) | user_id (PK), data (JSONB PG / JSON SQLite), updated_at | Whitelisted keys: profile_public, push_enabled, email_digest, profanity_filter, sound_enabled, reduce_motion, locale. |
| `user_blocks` | [app/models/user_block.py](../debatethis/app/models/user_block.py) | blocker_id, blocked_id (composite PK), created_at | Index on blocked_id for reverse lookup. |
| `audit_events` | [app/models/audit_event.py](../debatethis/app/models/audit_event.py) | id (BigInt), actor_id, kind, target_id (BigInt), event_metadata column-named `metadata` (JSONB PG / JSON SQLite), ip (INET PG / VARCHAR SQLite — NULL going forward; ip_hash lives in metadata), user_agent, created_at | Append-only. Indexes on (kind, created_at) and (actor_id, created_at). |

**Action items**

| Status | Item |
|--------|------|
| ⬜ | Run `prisma db pull` against Neon DATABASE_URL → commit `prisma/schema.prisma`. |
| ⬜ | Verify all 18 tables above land in the generated schema. |
| ⬜ | Diff Prisma's inferred types vs the Python model column types — flag any drift. |
| ⬜ | Add `@@map("metadata")` for the `event_metadata` ↔ `metadata` column-name remap on audit_events. |
| ⬜ | Set Prisma `connection_limit` low (Neon pgbouncer pool budget). |
| ⬜ | Wire a Prisma middleware that runs `SET statement_timeout = 30000` on every connect — see [app/__init__.py:21](../debatethis/app/__init__.py) for the rationale (PgBouncer rejects libpq `options`). |

---

## 2. Authentication, cookies, and tokens

| Concern | Python source | Next.js target | Status |
|---------|---------------|----------------|--------|
| JWT issuance | `flask_jwt_extended` with `JWT_SECRET_KEY`, HS256 default | Auth.js Credentials provider + custom `jose.SignJWT` (so the JWT format matches Python's `create_access_token`) | ⬜ |
| Access cookie name | `dt_access` | Same; set via Auth.js cookie name override | ⬜ |
| Refresh cookie name | `dt_refresh`, scoped to `/api/auth` | Same; same path scope | ⬜ |
| CSRF cookie | `dt_csrf_access`, readable by JS, echoed in `X-CSRF-TOKEN` header on writes | Same double-submit pattern — Next API routes verify the header against the cookie | ⬜ |
| Access TTL | 1 hour (env `JWT_ACCESS_TOKEN_HOURS`) | Same | ⬜ |
| Refresh TTL | 30 days (env `JWT_REFRESH_TOKEN_DAYS`) | Same | ⬜ |
| Cookie flags | `httpOnly`, `Secure` (prod), `SameSite=Lax` | Same | ⬜ |
| Cookie domain | `.debatethisnow.com` (set by Fly host) | Same | ⬜ |
| Bot API key auth | `Authorization: Bearer dt_xxxx` resolves to a User with `api_key=token` | Same; helper in `lib/auth/bot-key.ts` | ⬜ |
| Login timing equalization | Dummy bcrypt on no-such-user path; see [app/services/auth_service.py:23](../debatethis/app/services/auth_service.py) | Same — bcryptjs against a precomputed dummy hash | ⬜ |
| JWT revocation list | In-memory dict + lock; `jti → exp`; [app/services/token_service.py](../debatethis/app/services/token_service.py) | `lib/services/token-service.ts` mirrors API. Single-Node process means in-memory works; revisit when scaling. | ⬜ |
| Reserved usernames | admin/administrator/root/system/moderator/mod/support/help/official/staff/team/debatethis/debate/anonymous/anon/null/none/owner/operator/security/abuse + `deleted_` and `gone-` prefixes | Constant list in `lib/validation/username.ts` | ⬜ |
| Username regex | `^[a-zA-Z0-9_-]+$`, 3-32 chars | Same | ⬜ |
| Username changes per year | 3 in any rolling 365 days; stored as JSON array of ISO timestamps in `users.username_changes` | Same; audit_logged via `username_changed` kind | ⬜ |
| OAuth providers | Google (OIDC), GitHub (REST), Twitter v2 (PKCE) via Authlib | Auth.js providers with same client_id/secret env vars, same callback URL paths | ⬜ |
| Twitter no-email fallback | Synthesize `oauth-{user_id}@noemail.twitter.debatethis.local` | Same synthesized address pattern (preserved so existing Twitter users still match by email) | ⬜ |
| OAuth find-or-create | `auth_service.find_or_create_oauth_user` — username slug from email prefix or display name, reserved-name probe, fallback to `_n` suffix or hex suffix | Mirror semantics; same username generation logic | ⬜ |

---

## 3. HTTP API routes (REST surface)

Format: `<METHOD> <path> · <python_source>:<line> · <new_location>` plus a one-line behavior summary.

### 3.1 Auth (`/api/auth`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| POST | `/api/auth/register` | [auth.py:53](../debatethis/app/routes/auth.py) | `app/api/auth/register/route.ts` | username + email + password (≥6) validated; reserved-name + regex check; bcrypt hash; creates UserStats row; sets `dt_access` + `dt_refresh` + `dt_csrf_access` cookies; returns `{ user: to_private_dict }`. | ⬜ |
| POST | `/api/auth/login` | [auth.py:73](../debatethis/app/routes/auth.py) | `app/api/auth/login/route.ts` | Identifier (username OR email) + password; per-IP + per-identifier rate-limit (default 10/min each); dummy-bcrypt on no-such-user path; cookies same as register; returns `to_private_dict`. | ⬜ |
| POST | `/api/auth/refresh` | [auth.py:95](../debatethis/app/routes/auth.py) | `app/api/auth/refresh/route.ts` | Reads refresh cookie; checks revocation; mints new access cookie. | ⬜ |
| GET | `/api/auth/me` | [auth.py:114](../debatethis/app/routes/auth.py) | `app/api/auth/me/route.ts` | Returns `to_private_dict` for the calling user. Accepts JWT cookie OR bot API key header. | ⬜ |
| DELETE | `/api/auth/me` | [auth.py:239](../debatethis/app/routes/auth.py) | `app/api/auth/me/route.ts` (DELETE) | Password-confirmed self-deletion (GDPR/CCPA right to erasure). Scrubs PII: renames to `gone-{id}-{hex}`, sets `is_banned=true`, nulls bot fields. Revokes the current JWT jti. Records `user_deleted` audit. | ⬜ |
| PATCH | `/api/auth/me/username` | [auth.py:126](../debatethis/app/routes/auth.py) | `app/api/auth/me/username/route.ts` | 3 changes per rolling 365 days; case-insensitive uniqueness; reserved-name + regex check; audit-logged `username_changed`. | ⬜ |
| POST | `/api/auth/logout` | [auth.py:212](../debatethis/app/routes/auth.py) | `app/api/auth/logout/route.ts` | Revokes the current JWT jti; sets `online_status='offline'`; clears all auth cookies. | ⬜ |

### 3.2 OAuth (`/api/auth/oauth`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/auth/oauth/google` | [oauth.py:99](../debatethis/app/routes/oauth.py) | Auth.js handles via provider config | Redirect to Google authorize URL. 404 if not configured. | ⬜ |
| GET | `/api/auth/oauth/google/callback` | [oauth.py:108](../debatethis/app/routes/oauth.py) | Auth.js handles | Exchange code, find-or-create by email, issue JWT cookies, redirect to `/dashboard`. | ⬜ |
| GET | `/api/auth/oauth/github` | [oauth.py:140](../debatethis/app/routes/oauth.py) | Auth.js handles | Same pattern. | ⬜ |
| GET | `/api/auth/oauth/github/callback` | [oauth.py:149](../debatethis/app/routes/oauth.py) | Auth.js handles | Pull `/user` + `/user/emails`; pick primary verified. | ⬜ |
| GET | `/api/auth/oauth/twitter` | [oauth.py:195](../debatethis/app/routes/oauth.py) | Auth.js handles | PKCE flow. | ⬜ |
| GET | `/api/auth/oauth/twitter/callback` | [oauth.py:204](../debatethis/app/routes/oauth.py) | Auth.js handles | Synthesize email from twitter_id (Twitter v2 doesn't return email). | ⬜ |

Auth.js cookie names must be overridden to match the Python `dt_access`/`dt_refresh`/`dt_csrf_access` so a logged-in user can flip between apps mid-session.

### 3.3 Users + leaderboard (`/api/users`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/users/leaderboard` | [users.py:12](../debatethis/app/routes/users.py) | `app/api/users/leaderboard/route.ts` | Top 50 by Elo desc; each row enriched with `rank` index; uses `to_public_dict`. | ⬜ |
| GET | `/api/users/me/stats` | [users.py:26](../debatethis/app/routes/users.py) | `app/api/users/me/stats/route.ts` | `{ user: to_private_dict, stats: UserStats.to_dict }`. | ⬜ |
| GET | `/api/users/me/debates` | [users.py:36](../debatethis/app/routes/users.py) | `app/api/users/me/debates/route.ts` | 50 most recent debates where the user is a participant. | ⬜ |
| GET | `/api/users/me/active-debates` | [users.py:49](../debatethis/app/routes/users.py) | `app/api/users/me/active-debates/route.ts` | All PENDING/LIVE/VOTING debates the user is in; newest first. Powers the "Resume Debate" banner. | ⬜ |
| GET | `/api/users/<id>` | [users.py:78](../debatethis/app/routes/users.py) | `app/api/users/[id]/route.ts` | Public profile: `to_public_dict` + UserStats + 10 most recent COMPLETED debates. | ⬜ |

### 3.4 Debates (`/api/debates`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/debates/active` | [debates.py:62](../debatethis/app/routes/debates.py) | `app/api/debates/active/route.ts` | LIVE/VOTING debates with ≥1 message OR started <2min ago. Opportunistic `_sweep_orphans` on read. Filters out showcase (bot-vs-bot) debates. Limit 20, ordered by `started_at` desc. | ⬜ |
| GET | `/api/debates/trending` | [debates.py:128](../debatethis/app/routes/debates.py) | `app/api/debates/trending/route.ts` | Hardcoded 10-topic list (TRENDING_TOPICS in matchmaking_service); slice to ?limit. | ⬜ |
| GET | `/api/debates/recent` | [debates.py:133](../debatethis/app/routes/debates.py) | `app/api/debates/recent/route.ts` | COMPLETED debates where BOTH players spoke ≥once. Limit 30, ordered by `completed_at` desc. | ⬜ |
| POST | `/api/debates/cleanup-stale` | [debates.py:150](../debatethis/app/routes/debates.py) | `app/api/debates/cleanup-stale/route.ts` | Admin-only. Marks 15-min-stale, no-message LIVE/VOTING debates as ABANDONED. | ⬜ |
| POST | `/api/debates` (and `/api/debates/`) | [debates.py:175](../debatethis/app/routes/debates.py) | `app/api/debates/route.ts` (POST) | Enters caller into the matchmaking queue with topic/category. Returns `{ queued: true, topic, category, queue_size }`. Topic max 255 chars, category max 64. | ⬜ |
| GET | `/api/debates/<id>` | [debates.py:208](../debatethis/app/routes/debates.py) | `app/api/debates/[id]/route.ts` | Full debate dict with messages, plus DebateResult if completed, plus per-round breakdown + best argument when messages exist. **Spectator block check**: 404 if viewer is mutually blocked with either participant. | ⬜ |
| POST | `/api/debates/<id>/vote` | [debates.py:229](../debatethis/app/routes/debates.py) | `app/api/debates/[id]/vote/route.ts` | Rate-limited (60/min default). Calls `debate_service.cast_vote`; rejects participants; salted-IP-hash sockpuppet dedup. Returns updated debate. | ⬜ |
| GET | `/api/debates/<id>/my-vote` | [debates.py:249](../debatethis/app/routes/debates.py) | `app/api/debates/[id]/my-vote/route.ts` | `{ voted: bool, vote_for: id|null, is_participant: bool }`. | ⬜ |
| POST | `/api/debates/<id>/finalize` | [debates.py:263](../debatethis/app/routes/debates.py) | `app/api/debates/[id]/finalize/route.ts` | Participant-only. Forces finalize (returns existing result if already done). | ⬜ |
| POST | `/api/debates/<id>/forfeit` | [debates.py:275](../debatethis/app/routes/debates.py) | `app/api/debates/[id]/forfeit/route.ts` | Voluntary forfeit. Concedes to opponent and runs `finalize_debate`. Emits `debate_finished` socket event with `reason: "forfeit"`. | ⬜ |

### 3.5 Matchmaking (`/api/matchmaking`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| POST | `/api/matchmaking/queue` | [matchmaking.py:12](../debatethis/app/routes/matchmaking.py) | `app/api/matchmaking/queue/route.ts` (POST) | `matchmaking_service.enter_queue`. Returns `{ queued: true, entry: <queue_dict>, queue_size }`. | ⬜ |
| DELETE | `/api/matchmaking/queue` | [matchmaking.py:28](../debatethis/app/routes/matchmaking.py) | `app/api/matchmaking/queue/route.ts` (DELETE) | `leave_queue`. Returns `{ queued: false, queue_size }`. | ⬜ |
| GET | `/api/matchmaking/queue` | [matchmaking.py:35](../debatethis/app/routes/matchmaking.py) | `app/api/matchmaking/queue/route.ts` (GET) | `{ in_queue, queue_size, entry }`. | ⬜ |
| GET | `/api/matchmaking/topics` | [matchmaking.py:46](../debatethis/app/routes/matchmaking.py) | `app/api/matchmaking/topics/route.ts` | First 20 of TRENDING_TOPICS. | ⬜ |

### 3.6 Bots (`/api/bots`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/bots` (and `/`) | [bots.py:25](../debatethis/app/routes/bots.py) | `app/api/bots/route.ts` (GET) | Public directory. Includes `online_status` + house-bot `brain` metadata. House bots reported as online regardless of stored status (server is the brain). | ⬜ |
| GET | `/api/bots/mine` | [bots.py:67](../debatethis/app/routes/bots.py) | `app/api/bots/mine/route.ts` | Owner-only list; each bot includes its `api_key` + `online_status`. | ⬜ |
| POST | `/api/bots` | [bots.py:88](../debatethis/app/routes/bots.py) | `app/api/bots/route.ts` (POST) | Register bot. Username 3-32 chars, regex `^[a-zA-Z0-9_]+$`, must end `_bot`. Mints `dt_` API key (one-time reveal). | ⬜ |
| POST | `/api/bots/<id>/rotate-key` | [bots.py:147](../debatethis/app/routes/bots.py) | `app/api/bots/[id]/rotate-key/route.ts` | Owner or admin. Returns new key. | ⬜ |
| DELETE | `/api/bots/<id>` | [bots.py:160](../debatethis/app/routes/bots.py) | `app/api/bots/[id]/route.ts` (DELETE) | Owner or admin. Hard delete. | ⬜ |
| POST | `/api/bots/battle` | [bots.py:173](../debatethis/app/routes/bots.py) | `app/api/bots/battle/route.ts` | Stage bot-vs-bot debate. Both bots must be online OR be house bots. Refuses if either is `in_debate`. Creates LIVE debate, sets `in_debate` status, kicks off via `start_turn`. Emits `match_found` to both `user:<id>` rooms. | ⬜ |

### 3.7 Challenges (`/api/challenges`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| POST | `/api/challenges` | [challenges.py:15](../debatethis/app/routes/challenges.py) | `app/api/challenges/route.ts` (POST) | By username. Self-challenge rejected. Block-aware (404 on either-way block). Notification `challenge_received` fires. | ⬜ |
| GET | `/api/challenges/inbox` | [challenges.py:63](../debatethis/app/routes/challenges.py) | `app/api/challenges/inbox/route.ts` | Pending challenges targeting the caller. | ⬜ |
| GET | `/api/challenges/sent` | [challenges.py:75](../debatethis/app/routes/challenges.py) | `app/api/challenges/sent/route.ts` | Up to 50 most-recent sent challenges. | ⬜ |
| POST | `/api/challenges/<id>/accept` | [challenges.py:86](../debatethis/app/routes/challenges.py) | `app/api/challenges/[id]/accept/route.ts` | Creates Debate (LIVE, R1, challenger as p1 FOR, target as p2 AGAINST); marks challenge accepted+linked; emits `match_found` to both; notifies challenger via `challenge_accepted`. | ⬜ |
| POST | `/api/challenges/<id>/decline` | [challenges.py:154](../debatethis/app/routes/challenges.py) | `app/api/challenges/[id]/decline/route.ts` | Marks declined; notifies challenger `challenge_declined`. | ⬜ |

### 3.8 Friends (`/api`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/users/search` | [friends.py:41](../debatethis/app/routes/friends.py) | `app/api/users/search/route.ts` | Prefix search (?q=). Excludes self, bots, banned. Annotates `relationship` per row. | ⬜ |
| POST | `/api/friends/request` | [friends.py:86](../debatethis/app/routes/friends.py) | `app/api/friends/request/route.ts` | Idempotent. Block-aware. Emits `friend_request` to target user room + persists `friend_request` notification. | ⬜ |
| POST | `/api/friends/<id>/accept` | [friends.py:153](../debatethis/app/routes/friends.py) | `app/api/friends/[id]/accept/route.ts` | Flips to `accepted`. Emits `friend_accepted` to requester. | ⬜ |
| POST | `/api/friends/<id>/decline` | [friends.py:185](../debatethis/app/routes/friends.py) | `app/api/friends/[id]/decline/route.ts` | DELETES the row. Emits `friend_declined` notification. | ⬜ |
| DELETE | `/api/friends/<id>` | [friends.py:212](../debatethis/app/routes/friends.py) | `app/api/friends/[id]/route.ts` (DELETE) | Either side may unfriend or cancel a pending. | ⬜ |
| GET | `/api/friends` | [friends.py:229](../debatethis/app/routes/friends.py) | `app/api/friends/route.ts` (GET) | All accepted friendships involving the caller. Each row has `friend` = the OTHER user from viewer's POV. | ⬜ |
| GET | `/api/friends/requests` | [friends.py:244](../debatethis/app/routes/friends.py) | `app/api/friends/requests/route.ts` | `{ incoming: [...], outgoing: [...] }` of pending. | ⬜ |

### 3.9 Blocks (`/api`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/blocks` | [blocks.py:19](../debatethis/app/routes/blocks.py) | `app/api/blocks/route.ts` (GET) | Caller's blocks newest first. | ⬜ |
| POST | `/api/users/<id>/block` | [blocks.py:38](../debatethis/app/routes/blocks.py) | `app/api/users/[id]/block/route.ts` (POST) | Rate-limited (30/min). Drops any friendship in either direction. Audit-logs `user_block`. | ⬜ |
| DELETE | `/api/users/<id>/block` | [blocks.py:49](../debatethis/app/routes/blocks.py) | `app/api/users/[id]/block/route.ts` (DELETE) | Audit-logs `user_unblock`. | ⬜ |

### 3.10 Notifications (`/api`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/notifications` | [notifications.py:21](../debatethis/app/routes/notifications.py) | `app/api/notifications/route.ts` | `?unread=1` and `?limit=N` (max 100). Returns `{ notifications, unread_count }`. | ⬜ |
| GET | `/api/notifications/unread-count` | [notifications.py:45](../debatethis/app/routes/notifications.py) | `app/api/notifications/unread-count/route.ts` | `{ unread_count }`. | ⬜ |
| POST | `/api/notifications/<id>/read` | [notifications.py:52](../debatethis/app/routes/notifications.py) | `app/api/notifications/[id]/read/route.ts` | Rate-limited 60/min. Idempotent. | ⬜ |
| POST | `/api/notifications/read-all` | [notifications.py:61](../debatethis/app/routes/notifications.py) | `app/api/notifications/read-all/route.ts` | Rate-limited 10/min. | ⬜ |

### 3.11 Reports (`/api/reports`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| POST | `/api/reports` | [reports.py:30](../debatethis/app/routes/reports.py) | `app/api/reports/route.ts` (POST) | Rate-limited (default 20/hour). reason whitelist. note max 1000 chars. Optionally resolves target user from `message_id`. | ⬜ |
| GET | `/api/reports` | [reports.py:86](../debatethis/app/routes/reports.py) | `app/api/reports/route.ts` (GET) | Admin only. `?status=pending|dismissed|actioned`. Limit 200. | ⬜ |
| PUT | `/api/reports/<id>` | [reports.py:100](../debatethis/app/routes/reports.py) | `app/api/reports/[id]/route.ts` (PUT) | Admin only. Set status + optional `ban_target: true` flips target user `is_banned=true`. | ⬜ |

### 3.12 Settings (`/api/settings`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/settings/bot` | [settings.py:43](../debatethis/app/routes/settings.py) | `app/api/settings/bot/route.ts` (GET) | Public. `{ current, default, choices }`. Used by bot.py SDK and dev-mode picker. | ⬜ |
| PUT | `/api/settings/bot` | [settings.py:65](../debatethis/app/routes/settings.py) | `app/api/settings/bot/route.ts` (PUT) | Authenticated. Updates app_settings.bot_model. | ⬜ |
| PUT | `/api/settings/llm-scorer` | [settings.py:54](../debatethis/app/routes/settings.py) | `app/api/settings/llm-scorer/route.ts` | Admin only. Toggles `llm_scorer_enabled`. | ⬜ |
| GET | `/api/settings/me` | [settings.py:84](../debatethis/app/routes/settings.py) | `app/api/settings/me/route.ts` (GET) | Effective per-user settings (defaults overlaid with overrides). | ⬜ |
| PUT | `/api/settings/me` | [settings.py:92](../debatethis/app/routes/settings.py) | `app/api/settings/me/route.ts` (PUT) | Partial update with whitelist validation; returns `{ ok, settings, rejected }`. | ⬜ |

### 3.13 Achievements (`/api/achievements`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/achievements/catalog` | [achievements.py:11](../debatethis/app/routes/achievements.py) | `app/api/achievements/catalog/route.ts` | Ordered by tier, code. | ⬜ |
| GET | `/api/achievements/me` | [achievements.py:17](../debatethis/app/routes/achievements.py) | `app/api/achievements/me/route.ts` | UserAchievement rows for caller. | ⬜ |
| GET | `/api/achievements/user/<id>` | [achievements.py:23](../debatethis/app/routes/achievements.py) | `app/api/achievements/user/[id]/route.ts` | Public. | ⬜ |

### 3.14 Daily topic (`/api/daily`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/daily/topic` | [daily.py:10](../debatethis/app/routes/daily.py) | `app/api/daily/topic/route.ts` | `{ daily: { topic, category, set_at } \| null }`. | ⬜ |
| PUT | `/api/daily/topic` | [daily.py:16](../debatethis/app/routes/daily.py) | `app/api/daily/topic/route.ts` (PUT) | Admin only. Empty topic clears it. | ⬜ |
| POST | `/api/daily/queue` | [daily.py:31](../debatethis/app/routes/daily.py) | `app/api/daily/queue/route.ts` | Enter matchmaking with daily topic. 400 if no daily set. | ⬜ |

### 3.15 i18n (`/api/i18n`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/i18n/languages` | [i18n.py:8](../debatethis/app/routes/i18n.py) | `app/api/i18n/languages/route.ts` | `{ default, languages: [{code,label,flag}] }`. | ⬜ |
| GET | `/api/i18n/<lang>` | [i18n.py:16](../debatethis/app/routes/i18n.py) | `app/api/i18n/[lang]/route.ts` | Translation bundle. Unknown lang → defaults. | ⬜ |

### 3.16 Debug logs (`/api/debug/logs`)

| Method | Path | Python source | Next location | Behavior | Status |
|--------|------|---------------|---------------|----------|--------|
| GET | `/api/debug/logs` | [debug_logs.py:71](../debatethis/app/routes/debug_logs.py) | `app/api/debug/logs/route.ts` | Admin OR DEV_MODE. Whitelist of log files. | ⬜ |
| GET | `/api/debug/logs/<name>` | [debug_logs.py:92](../debatethis/app/routes/debug_logs.py) | `app/api/debug/logs/[name]/route.ts` | `?lines=N` (max 2000), `?grep=regex`. | ⬜ |

### 3.17 Static / SEO

| Method | Path | Python source | Next location | Status |
|--------|------|---------------|---------------|--------|
| GET | `/robots.txt` | [pages.py:131](../debatethis/app/routes/pages.py) | `app/robots.ts` (Next dynamic robots) | ⬜ |
| GET | `/ads.txt` | [pages.py:87](../debatethis/app/routes/pages.py) | `app/ads.txt/route.ts` | ⬜ |
| GET | `/healthz` | [pages.py:112](../debatethis/app/routes/pages.py) | `app/healthz/route.ts` | Prisma `$queryRaw\`SELECT 1\`` probe. | ⬜ |

---

## 4. Socket.IO events

Server lives in `server.ts`. Mounts both Next handler + Socket.IO on the
same port. JWT cookie + bot API key both accepted on the handshake (parse
`dt_access` from handshake cookies, verify via `JWT_SECRET_KEY`).

**Rooms**
- `user:<id>` — every authed socket joins on connect; targets for `match_found`, `notification`, `friend_request`, `friend_accepted`.
- `debate:<id>` — every join_debate joins; targets for `debate_state`, `argument_posted`, `turn_changed`, `vote_update`, `voting_open`, `debate_finished`, `spectator_count`, `presence`, `opponent_typing`, `debate_abandoned`.

### 4.1 Connection lifecycle

| Event | Direction | Python source | Behavior |
|-------|-----------|---------------|----------|
| `connect` | client→server | [matchmaking_events.py:30](../debatethis/app/sockets/matchmaking_events.py) | Auth handshake. On success: join `user:<id>` room, set `online_status='online'`, emit `connected` with `{user_id, username}`. |
| `disconnect` | client→server | [matchmaking_events.py:45](../debatethis/app/sockets/matchmaking_events.py) | Cleans spectator presence, marks user offline (except `in_debate`), schedules forfeit timer if user is mid-debate, removes user from matchmaking queue if `socket_sid` matches. |
| `connected` | server→client | — | Acknowledgment to the connecting client. |
| `error` | server→client | — | Single-client error message (never broadcast). |

### 4.2 Matchmaking events

| Event | Direction | Python source | Behavior |
|-------|-----------|---------------|----------|
| `join_matchmaking` | client→server | [matchmaking_events.py:119](../debatethis/app/sockets/matchmaking_events.py) | Refuses if user has an active debate. Wraps enter_queue → find_match → create_debate in `matchmaking_lock()`. On match: emits `match_found` to both users' rooms. |
| `leave_matchmaking` | client→server | [matchmaking_events.py:182](../debatethis/app/sockets/matchmaking_events.py) | `leave_queue` + emit `queue_update`. |
| `ping_presence` | client→server | [matchmaking_events.py:196](../debatethis/app/sockets/matchmaking_events.py) | Echoes `presence` to caller. |
| `queue_update` | server→client | — | `{ queued: bool, queue_size: int, reason?: string }`. |
| `match_found` | server→client | — | `{ debate_id, topic, category, redirect_url }`. Client auto-navigates to `redirect_url`. |

### 4.3 Debate room events

| Event | Direction | Python source | Behavior |
|-------|-----------|---------------|----------|
| `join_debate` | client→server | [debate_events.py:373](../debatethis/app/sockets/debate_events.py) | Spectator block check (404-style error if blocked). Joins `debate:<id>` room. Tracks spectator presence. If participant: kicks off turn timer when needed; cancels pending forfeit. For showcase debates with empty messages, schedules first house-bot turn. |
| `leave_debate` | client→server | [debate_events.py:466](../debatethis/app/sockets/debate_events.py) | Leaves room. Untracks sid. Emits new `spectator_count`. |
| `request_state` | client→server | [debate_events.py:614](../debatethis/app/sockets/debate_events.py) | Auth required. Rate-limited (10/5s). Emits `debate_state` to caller. |
| `submit_argument` | client→server | [debate_events.py:479](../debatethis/app/sockets/debate_events.py) | Auth + participant + correct-turn + not-prep gates. Min/max word + max byte gates (configurable). Calls `submit_argument`, emits `argument_posted`, calls `advance_turn`, emits new state + `turn_changed`. If `outcome.finished`: emits `voting_open` and schedules finalize. Schedules house-bot's next turn if applicable. |
| `ready_for_turn` | client→server | [debate_events.py:635](../debatethis/app/sockets/debate_events.py) | Active player skips remaining prep. Calls `start_speaking_now`, broadcasts state + turn_changed, schedules turn timeout. |
| `cast_vote` | client→server | [debate_events.py:581](../debatethis/app/sockets/debate_events.py) | Rate-limited (5/sec). Calls `cast_vote` with IP hash. Emits `vote_update` to room, `vote_accepted` or `vote_rejected` to caller. |
| `typing` | client→server | [debate_events.py:784](../debatethis/app/sockets/debate_events.py) | Rate-limited (5/sec). Active-speaker-only. Broadcasts `opponent_typing` to room (excluding sender). |
| `advance_round_showcase` | client→server | [debate_events.py:671](../debatethis/app/sockets/debate_events.py) | Spectator-only. Calls `begin_next_round_showcase`. Broadcasts state + turn_changed. Schedules next house-bot turn. |
| `open_voting_showcase` | client→server | [debate_events.py:719](../debatethis/app/sockets/debate_events.py) | Spectator-only. Calls `open_voting_showcase`. Broadcasts state + voting_open + schedules finalize. |
| `abandon_debate_showcase` | client→server | [debate_events.py:755](../debatethis/app/sockets/debate_events.py) | Spectator-only. Calls `abandon_showcase`. Emits `debate_abandoned`. |

### 4.4 Server-only emits

| Event | Direction | Payload | Trigger |
|-------|-----------|---------|---------|
| `debate_state` | server→room/client | full `Debate.to_dict(include_messages=True)` + my_role/my_vote/spectator_count for first emit | on join, on submit, on advance, on showcase actions, on request_state |
| `argument_posted` | server→room | `DebateMessage.to_dict()` | submit_argument |
| `turn_changed` | server→room | `{ debate_id, round, phase, current_turn_user_id, seconds_remaining, is_prep, auto }` | turn transition |
| `voting_open` | server→room | `{ debate_id, seconds }` | rounds done |
| `vote_update` | server→room | `{ debate_id, votes_player1, votes_player2 }` | cast_vote success |
| `vote_accepted` | server→caller | `{ debate_id, vote_for }` | cast_vote success |
| `vote_rejected` | server→caller | `{ debate_id, reason }` | cast_vote failure |
| `debate_finished` | server→room | `{ debate: ..., result: ..., reason?: "forfeit"|"forfeit_disconnect", forfeited_user_id? }` | finalize |
| `debate_abandoned` | server→room | `{ debate_id }` | abandon_showcase |
| `spectator_count` | server→room | `{ debate_id, count }` | join/leave |
| `presence` | server→room (excl self) | `{ debate_id, user, joined, is_spectator }` | join_debate |
| `opponent_typing` | server→room (excl sender) | `{ debate_id, user_id, word_count, active }` | typing |
| `notification` | server→`user:<id>` | `Notification.to_dict()` | every `notify(channels=("inapp",))` |
| `friend_request` | server→`user:<id>` | `{ friendship: ... }` | POST /api/friends/request |
| `friend_accepted` | server→`user:<id>` | `{ friendship: ... }` | POST /api/friends/<id>/accept |

### 4.5 Subtle background state to preserve

These are the parts that took the Python app several iterations to get right. The Next implementation MUST preserve their semantics exactly.

| Concern | Python source | What to preserve |
|---------|---------------|------------------|
| Turn-timeout scheduler — single source of truth | [debate_events.py:251-371](../debatethis/app/sockets/debate_events.py) | `_scheduled_for[debate_id] = deadline`. Claim/release lock. On wake: re-fetch row, **CAS check** that `turn_deadline == deadline`. If not, abort silently. Spectator joins must NOT spawn duplicate timers. |
| Finalize-after-voting scheduler | [debate_events.py:20-86](../debatethis/app/sockets/debate_events.py) | `_finalize_scheduled` set + lock. One finalize task per debate. Background sleep then re-fetch + status check. |
| Disconnect → forfeit timer | [debate_events.py:139-244](../debatethis/app/sockets/debate_events.py) | `(debate_id, user_id) → deadline_ts`. Reconnect cancels. Showcase debates exempt. 90s default grace. Finalize fires through the same `finalize_debate` code path with vote-stuffing to force the opponent's win. |
| Spectator presence tracker | [debate_events.py:89-135](../debatethis/app/sockets/debate_events.py) | `_sid_room[sid] = (debate_id, user_id, is_spectator)`. Decrement-only when no other sid for same user remains in room. |
| Per-socket rate limiter | [_auth.py:70-97](../debatethis/app/sockets/_auth.py) | `(sid, event) → [timestamps]` sliding window. Used for `submit_argument`(2/2s), `cast_vote`(5/1s), `typing`(5/1s), `request_state`(10/5s), `advance_round_showcase`(2/2s), `open_voting_showcase`(2/2s). |
| Matchmaking lock | [matchmaking_service.py:18-23](../debatethis/app/services/matchmaking_service.py) | Global lock around `enter_queue → find_match → create_debate_for_pair → start_turn` so two simultaneous joins can't double-create. |
| House-bot turn scheduling | [bot_brain.py:878-907](../debatethis/app/services/bot_brain.py) | `start_background_task` (Node-equivalent: `setImmediate` or `setTimeout`) wakes worker, re-fetches debate, generates via brain → cross-Groq fallback → canned templates, submits argument via `submit_argument`, then chains to next bot's turn (or `paused`/`finished`). |
| Cross-brain Groq fallback | [bot_brain.py:626-659](../debatethis/app/services/bot_brain.py) | If a bot's primary brain returns null AND brain ≠ groq AND GROQ_API_KEY is set, retry via Groq. If both fail, fall back to canned template bank. |
| Canned-template bank | [bot_brain.py:666-738](../debatethis/app/services/bot_brain.py) | 4 personalities × 3 rounds × 3 templates each (36 total). Random.choice on selection. `{topic}` interpolated. |

---

## 5. Service layer → `lib/services/*.ts`

| Python file | Next file | Key exports | Status |
|-------------|-----------|-------------|--------|
| [app/services/auth_service.py](../debatethis/app/services/auth_service.py) | `lib/services/auth-service.ts` | `registerUser()`, `authenticate()`, `findOrCreateOAuthUser()`, `_DUMMY_PASSWORD_HASH` | ⬜ |
| [app/services/token_service.py](../debatethis/app/services/token_service.py) | `lib/services/token-service.ts` | `revoke()`, `isRevoked()`, `revokeAllForUser()` (stub) | ⬜ |
| [app/services/debate_service.py](../debatethis/app/services/debate_service.py) | `lib/services/debate-service.ts` | `startTurn()`, `startPrep()`, `startSpeakingNow()`, `advanceTurn()`, `beginNextRoundShowcase()`, `openVotingShowcase()`, `abandonShowcase()`, `submitArgument()`, `finalizeDebate()`, `forfeitDebate()`, `castVote()`, `hashIp()`, `getUserVote()`, `abandonStaleDebates()`, `isShowcaseDebate()`, `showcasePhase()`, `argumentCaps()`, `MIN_ARGUMENT_WORDS=15` | ⬜ |
| [app/services/matchmaking_service.py](../debatethis/app/services/matchmaking_service.py) | `lib/services/matchmaking-service.ts` | `enterQueue()`, `leaveQueue()`, `queueLength()`, `findMatchFor()`, `createDebateForPair()`, `hasActiveDebate()`, `trendingTopics()`, `randomTopic()`, `matchmakingLock()` (use `async-mutex` or a global Promise queue) | ⬜ |
| [app/services/elo_service.py](../debatethis/app/services/elo_service.py) | `lib/services/elo-service.ts` | `expectedScore()`, `calculateDelta()`, `applyMatch()`. K factor from env. | ⬜ |
| [app/services/scoring_service.py](../debatethis/app/services/scoring_service.py) | `lib/services/scoring-service.ts` | `aiScoreDebate()`, `roundBreakdown()`, `bestArgument()`, `combineScores()`, `summarizeDebate()`. Preserve `_STRONG_TERMS`/`_WEAK_TERMS` lists. | ⬜ |
| [app/services/llm_scorer_service.py](../debatethis/app/services/llm_scorer_service.py) | `lib/services/llm-scorer-service.ts` | `isEnabled()` + `scoreDebate()`. Use `@anthropic-ai/sdk`. | ⬜ |
| [app/services/notification_service.py](../debatethis/app/services/notification_service.py) | `lib/services/notification-service.ts` | `notify()`, `markRead()`, `markAllRead()`, `listForUser()`, `unreadCount()`. Coalesce window 30s. Per-kind per-minute caps. Block-aware. Emits via Socket.IO `to: user:<id>` room. | ⬜ |
| [app/services/block_service.py](../debatethis/app/services/block_service.py) | `lib/services/block-service.ts` | `isBlockedEitherWay()`, `blockedIdsFor()`, `listBlocksBy()`, `block()`, `unblock()`. Hard-split friendships on block. | ⬜ |
| [app/services/audit_service.py](../debatethis/app/services/audit_service.py) | `lib/services/audit-service.ts` | `record()`, `recent()`. Salted IP hash from SECRET_KEY. Best-effort (never throws). | ⬜ |
| [app/services/bot_brain.py](../debatethis/app/services/bot_brain.py) | `lib/services/bot-brain.ts` | `BRAINS`, `brainMeta()`, `seedMissingHouseBots()`, `releaseStuckHouseBots()`, `isHouseBot()`, `getPersonality()`, `getBrain()`, `maybeScheduleHouseTurn()`, internal `_generate` (4 brain SDKs + Groq fallback) and canned template bank. Roster (`_USERNAME_TO_PERSONALITY` and `_USERNAME_TO_BRAIN`) verbatim. | ⬜ |
| [app/services/achievement_service.py](../debatethis/app/services/achievement_service.py) | `lib/services/achievement-service.ts` | `seedCatalog()`, `checkForUser()`, `checkAfterDebate()`, `forUser()`. ACHIEVEMENT_CATALOG entries verbatim (11 codes). | ⬜ |
| [app/services/settings_service.py](../debatethis/app/services/settings_service.py) | `lib/services/settings-service.ts` | `getAll()`, `get()`, `setMany()`. Whitelist + type-check. | ⬜ |
| [app/services/daily_topic_service.py](../debatethis/app/services/daily_topic_service.py) | `lib/services/daily-topic-service.ts` | `getDaily()`, `setDaily()`, `clearDaily()` over AppSetting. | ⬜ |

**Shared infrastructure**

| Concern | Python | Next equivalent | Status |
|---------|--------|-----------------|--------|
| Prisma singleton | n/a | `lib/db.ts` exports `prisma` (one PrismaClient per Node process). Middleware sets `statement_timeout=30000` on every fresh connection. | ⬜ |
| Word count helper | [app/utils/helpers.py:5](../debatethis/app/utils/helpers.py) | `lib/utils/word-count.ts` — same regex `\b\w+\b`. | ⬜ |
| `jwt_user_required` decorator | [app/utils/decorators.py:10](../debatethis/app/utils/decorators.py) | `lib/auth/require-user.ts` — verify JWT cookie or `Authorization: Bearer dt_*` header → load User. Reject banned. | ⬜ |
| Per-IP rate limiter | Flask-Limiter (memory backend) | `@upstash/ratelimit` if Redis present, else in-memory sliding window in `lib/rate-limit.ts`. Same numeric configs from env. | ⬜ |

---

## 6. Pages (Next.js App Router)

| Path | Python template | Next page | Description | Status |
|------|----------------|-----------|-------------|--------|
| `/` | [templates/index.html](../debatethis/app/templates/index.html) | `app/page.tsx` | Landing page. If signed in, server-side redirect to `/dashboard`. | ⬜ |
| `/login` | [templates/login.html](../debatethis/app/templates/login.html) | `app/login/page.tsx` | OAuth buttons (only shown if env configured), email/username + password form. | ⬜ |
| `/register` | [templates/register.html](../debatethis/app/templates/register.html) | `app/register/page.tsx` | Same. | ⬜ |
| `/dashboard` | [templates/dashboard.html](../debatethis/app/templates/dashboard.html) | `app/dashboard/page.tsx` | Resume-active-debate banner, "Start New Debate" + "Join Random" CTAs, active debates feed, trending topics, daily topic, challenges inbox, past debates (own + community fallback), bot battle modal. | ⬜ |
| `/matchmaking` | [templates/matchmaking.html](../debatethis/app/templates/matchmaking.html) | `app/matchmaking/page.tsx` | Queue UI, elapsed timer, auto-redirect on `match_found`. | ⬜ |
| `/debate/[id]` | [templates/debate.html](../debatethis/app/templates/debate.html) | `app/debate/[id]/page.tsx` | The big one — see §6.1 below. | ⬜ |
| `/results/[id]` | [templates/results.html](../debatethis/app/templates/results.html) | `app/results/[id]/page.tsx` | End screen: winner, summary, per-round breakdown, key moment, Elo deltas. | ⬜ |
| `/profile` and `/profile/[id]` | [templates/profile.html](../debatethis/app/templates/profile.html) | `app/profile/page.tsx`, `app/profile/[id]/page.tsx` | Own (private) vs public. Recent debates + achievements grid. | ⬜ |
| `/leaderboard` | [templates/leaderboard.html](../debatethis/app/templates/leaderboard.html) | `app/leaderboard/page.tsx` | Top 50 by Elo. Rendered as "Rankings" in sidebar. | ⬜ |
| `/settings` | [templates/settings.html](../debatethis/app/templates/settings.html) | `app/settings/page.tsx` | Language picker (i18n bundles), bot model picker (DEV_MODE only), username change UI, account deletion, LLM scorer toggle (admins only), per-user prefs whitelist. | ⬜ |
| `/friends` | [templates/friends.html](../debatethis/app/templates/friends.html) | `app/friends/page.tsx` | Search, incoming/outgoing requests, friends list. | ⬜ |
| `/bots` | [templates/bots.html](../debatethis/app/templates/bots.html) | `app/bots/page.tsx` | Bot directory + create-bot UI (humans only). API key reveal on creation. | ⬜ |
| `/how-it-works` | [templates/how_it_works.html](../debatethis/app/templates/how_it_works.html) | `app/how-it-works/page.tsx` | Static explainer. Scoring, Elo, rank tiers. | ⬜ |
| `/blog` | [templates/blog_list.html](../debatethis/app/templates/blog_list.html) | `app/blog/page.tsx` | Article index. | ⬜ |
| `/blog/[slug]` | [templates/blog_article.html](../debatethis/app/templates/blog_article.html) | `app/blog/[slug]/page.tsx` | Markdown render with frontmatter parsing + mid-article ad slot injection. 27 articles in [app/blog/articles/](../debatethis/app/blog/articles/) to port. | ⬜ |
| `/terms` | templates/legal/terms.html | `app/terms/page.tsx` | Static legal. | ⬜ |
| `/privacy` | templates/legal/privacy.html | `app/privacy/page.tsx` | Static legal. | ⬜ |
| `/admin` | [templates/admin.html](../debatethis/app/templates/admin.html) | `app/admin/page.tsx` | Server-gated (`getServerSession()` + `is_admin` check). 404 for non-admins. Reports list, daily topic editor, LLM scorer toggle, audit log viewer (new), house-bot management (new). | ⬜ |

### 6.1 `/debate/[id]` component breakdown

All state lives in a single Zustand store (one store instance per debate room) fed by Socket.IO events. Components observe selectors so they only re-render on the slice they care about.

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `DebateHeader` | Topic, round pill, MM:SS timer, "FORFEIT" button | ⬜ |
| `PlayerCard ×2` | Name, Elo, current score, live votes, typing indicator | ⬜ |
| `Composer` | Textarea, live word count, submit button, min-words gate, prep banner overlay | ⬜ |
| `TurnStrip` | R1-P1, R1-P2, R2-P1, R2-P2, R3-P1, R3-P2 progress dots | ⬜ |
| `MessagesList` | Posted arguments with author label, click-to-read modal | ⬜ |
| `ReaderModal` | Full-text reader for a posted argument | ⬜ |
| `VotePanel` | Vote-for-P1 / Vote-for-P2 buttons, "voted" receipt, reopen pill | ⬜ |
| `ShowcasePanel` | REVEAL NEXT / BEGIN ROUND N+1 / OPEN VOTING / ABANDON buttons (spectator-only on showcase debates) | ⬜ |
| `EndScreen` | Overlay with winner, summary, round breakdown, key moment, Elo deltas | ⬜ |
| `PrepBanner` | "⏱ PREP — read your opponent, then start when ready" with "Start my turn" button | ⬜ |
| `IntroOverlay` | First-load animation: "Round 1: Opening Statement" | ⬜ |
| `RoundFlash` | Brief animation when a new round begins | ⬜ |

### 6.2 Timer subsystem (Zustand store, new headline win)

Owned by a single `lib/stores/timer-store.ts`. Inspired by the bugs documented in [app/static/js/debate.js](../debatethis/app/static/js/debate.js) `startLocalTimer`.

- Parses server's `turn_deadline` defensively: NaN → 0, > 15min → ∞ display, > 24h hard-clamped.
- Format everywhere as MM:SS — never raw seconds.
- Single `setInterval(1s)` driver for the whole room (not one per component).
- Re-syncs on every `debate_state`, `turn_changed`, `voting_open` event.

---

## 7. Layout, sidebar, and shared UI

| Concern | Python source | Next location | Status |
|---------|---------------|---------------|--------|
| Base layout | [templates/base.html](../debatethis/app/templates/base.html) | `app/layout.tsx` | ⬜ |
| Sidebar (nav + brand + footer) | base.html | `components/sidebar/Sidebar.tsx` | ⬜ |
| Sidebar collapse | base.html + onboarding.js | `lib/stores/ui-store.ts` with localStorage persist | ⬜ |
| Notifications bell + dropdown | base.html + notifications.js | `components/notifications/NotificationsBell.tsx` (TanStack Query + Socket.IO invalidation) | ⬜ |
| User mini footer | base.html | `components/sidebar/UserMini.tsx` | ⬜ |
| Cookie consent | cookie-consent.js | `components/CookieConsent.tsx` | ⬜ |
| Onboarding tutorial | [app/static/js/onboarding.js](../debatethis/app/static/js/onboarding.js) | `components/onboarding/TutorialOverlay.tsx` + Zustand store + localStorage. **Expanded coverage required**: ≥20 cards across 7 surfaces (dashboard, debate, showcase, leaderboard, friends, settings, bots). | ⬜ |
| Sound effects | sfx.js | `lib/sfx.ts` (preserve `sound_enabled` setting) | ⬜ |
| ad slot template | [templates/_ad_slot.html](../debatethis/app/templates/_ad_slot.html) | `components/AdSlot.tsx` (only renders if ADSENSE_CLIENT_ID configured) | ⬜ |

The detailed JS-file + template + CSS inventory (every DOM hook, every event
listener, every magic constant, every color token) lives in
[MIGRATION_UI_INVENTORY.md](MIGRATION_UI_INVENTORY.md). That document is the
source of truth for what each React component must do during Phase 5.

---

## 8. Visual design (Tailwind + shadcn/ui)

Match the existing visual language exactly. Don't redesign during the rewrite.

| Token | Python source | Tailwind equivalent | Status |
|-------|---------------|---------------------|--------|
| Paper background | static/css/main.css | Custom `bg-paper` token | ⬜ |
| Navy sidebar | main.css | Custom `bg-navy`/`text-navy` token | ⬜ |
| Gold accents | main.css | Custom `bg-gold`/`text-gold` token | ⬜ |
| Candy-stripe footer | main.css | Custom CSS via `@layer` (Tailwind background-image utility) | ⬜ |
| Oswald font | base.html via Google Fonts | `next/font/google` | ⬜ |
| Lora font | base.html | `next/font/google` | ⬜ |
| Bevan font | base.html | `next/font/google` | ⬜ |
| Mobile responsive | (desktop-only today) | **NEW**: full mobile-first responsive pass | ⬜ |

shadcn/ui components used: Button, Card, Dialog, Input, Textarea, Toast, DropdownMenu, Tooltip, Tabs, Avatar, Badge, Separator.

---

## 9. Static assets, content, i18n

| Asset | Python source | Next location | Status |
|-------|---------------|---------------|--------|
| Blog articles (27 .md files) | [app/blog/articles/](../debatethis/app/blog/articles/) | `content/blog/*.md` — render with `react-markdown` + `remark-gfm` + same frontmatter parsing + mid-article ad slot injection | ⬜ |
| Markdown frontmatter parser | [app/routes/blog.py:37](../debatethis/app/routes/blog.py) | `lib/blog/parse-frontmatter.ts` | ⬜ |
| Mid-article ad slot injector | [app/routes/blog.py:102](../debatethis/app/routes/blog.py) | `lib/blog/inject-ad-slot.ts` | ⬜ |
| i18n bundles (en, es) | [app/i18n.py](../debatethis/app/i18n.py) | `lib/i18n/strings.ts` + per-lang JSON in `public/i18n/<lang>.json` | ⬜ |
| Logo images | static/img/logo.png + logo-120.png | `public/logo.png` + `public/logo-120.png` | ⬜ |

---

## 10. Security non-negotiables (parity with Python)

Every item from the prompt's Security non-negotiables block, mapped to its implementation site.

| Item | Python source | Next location | Status |
|------|---------------|---------------|--------|
| JWT in httpOnly Secure SameSite=Lax cookie | [app/config.py:55-71](../debatethis/app/config.py) | Auth.js cookie options + custom token signing | ⬜ |
| No JWT in localStorage | [static/js/auth.js](../debatethis/app/static/js/auth.js) | All client code uses cookie-based auth; never reads JWT from localStorage | ⬜ |
| CSRF double-submit | [app/config.py:65-71](../debatethis/app/config.py) | Middleware in `middleware.ts` checks `X-CSRF-TOKEN` against `dt_csrf_access` cookie on POST/PUT/PATCH/DELETE to `/api/*` | ⬜ |
| Content Security Policy | [app/__init__.py:72-84](../debatethis/app/__init__.py) | `middleware.ts` sets CSP header. Allowlist includes Next runtime + Socket.IO endpoint + AdSense (when configured). | ⬜ |
| HSTS (prod only) | [app/__init__.py:111-115](../debatethis/app/__init__.py) | `middleware.ts` adds `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` when `NODE_ENV=production`. | ⬜ |
| X-Frame-Options: DENY | [app/__init__.py:99](../debatethis/app/__init__.py) | middleware.ts | ⬜ |
| Referrer-Policy: same-origin | [app/__init__.py:100](../debatethis/app/__init__.py) | middleware.ts | ⬜ |
| Permissions-Policy | [app/__init__.py:101-104](../debatethis/app/__init__.py) | middleware.ts | ⬜ |
| X-Content-Type-Options: nosniff | [app/__init__.py:98](../debatethis/app/__init__.py) | middleware.ts | ⬜ |
| X-Robots-Tag on /api/*, /debate/*, /results/*, /admin | [app/__init__.py:91, 109-110](../debatethis/app/__init__.py) | middleware.ts path prefix check | ⬜ |
| Per-IP + per-identifier login/register rate limits | [app/routes/auth.py:22-40](../debatethis/app/routes/auth.py) | `lib/rate-limit.ts` invoked from each route | ⬜ |
| Per-user report rate limit | [app/routes/reports.py:21-24](../debatethis/app/routes/reports.py) | Same | ⬜ |
| Per-user vote rate limit | [app/routes/debates.py:42-43](../debatethis/app/routes/debates.py) | Same | ⬜ |
| Per-socket submit/vote/typing/state/showcase rate limits | [app/sockets/_auth.py:70-97](../debatethis/app/sockets/_auth.py) | Same in-memory sliding window in `lib/sockets/rate-limit.ts` | ⬜ |
| Argument min words (15) + max words + max bytes | [app/services/debate_service.py:24-39](../debatethis/app/services/debate_service.py) | `lib/services/debate-service.ts` + Zod validation on `submit_argument` socket handler | ⬜ |
| Sockpuppet vote dedup (salted SHA-256 IP hash) | [app/services/debate_service.py:528-593](../debatethis/app/services/debate_service.py) | Same. Salt = `SECRET_KEY`. | ⬜ |
| Spectator block enforcement | [app/routes/debates.py:16-26](../debatethis/app/routes/debates.py), [app/sockets/debate_events.py:386-393](../debatethis/app/sockets/debate_events.py) | Both REST GET /debates/[id] AND socket join_debate check `isBlockedEitherWay` for each participant. | ⬜ |
| Username blacklist + deleted_/gone- prefix | [app/models/user.py:91-119](../debatethis/app/models/user.py) | `lib/validation/username.ts` | ⬜ |
| Login timing equalization | [app/services/auth_service.py:23, 80-85](../debatethis/app/services/auth_service.py) | `lib/services/auth-service.ts` precomputes dummy bcrypt hash; runs it on the no-such-user path. | ⬜ |
| Generic 500 in prod (no stack trace leak) | [app/__init__.py:462-471](../debatethis/app/__init__.py) | All API route handlers wrap in try/catch → log → return `{ error: "server_error", message: process.env.NODE_ENV === "production" ? "Internal server error" : String(e) }` | ⬜ |
| Per-PG-session statement_timeout=30000 | [app/__init__.py:21-40](../debatethis/app/__init__.py) | Prisma middleware on `$connect` — SQL `SET statement_timeout = 30000`. Not via libpq `options` (PgBouncer rejects). | ⬜ |
| DELETE /api/auth/me scrubs PII + revokes jti | [app/routes/auth.py:239-294](../debatethis/app/routes/auth.py) | Same — see § 3.1 | ⬜ |
| Audit-log on user_block/user_unblock/forfeit/report_submit/report_resolve/role-change/username_changed/oauth_signin/user_deleted | scattered across [services/audit_service.py](../debatethis/app/services/audit_service.py) call sites | Each call site mirrored in the Next services + routes | ⬜ |

---

## 11. Environment variables (Fly secrets to mirror)

These must be set as Fly secrets on the new app (`debatethisnow-next`) or the parity break is immediate.

| Variable | Source / purpose |
|----------|------------------|
| `DATABASE_URL` | Neon Postgres URL. Same value as the Python app's secret. |
| `SECRET_KEY` | Used as salt for IP hashing. Same value as Python app (otherwise hash comparisons across cutover fail). |
| `JWT_SECRET_KEY` | HMAC for JWT signing. Same value — non-negotiable for cross-app cookie compat. |
| `CORS_ORIGINS` | `https://debatethisnow.com,https://www.debatethisnow.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | OAuth |
| `GROQ_API_KEY` (+ `GROQ_MODEL`) | House bot brain |
| `GEMINI_API_KEY` (+ `GEMINI_MODEL`) | House bot brain |
| `MISTRAL_API_KEY` (+ `MISTRAL_MODEL`) | House bot brain |
| `CEREBRAS_API_KEY` (+ `CEREBRAS_MODEL`) | House bot brain |
| `ANTHROPIC_API_KEY` | LLM scorer (opt-in) |
| `ADSENSE_CLIENT_ID` + `ADSENSE_SLOT_BLOG_*` | Ads (optional) |
| `EXTRA_ADS_TXT_LINES` | ads.txt (pipe-separated) |
| `JWT_ACCESS_TOKEN_HOURS` / `JWT_REFRESH_TOKEN_DAYS` | TTLs |
| `ELO_K_FACTOR` (default 32) | |
| `MATCH_ELO_WINDOW` (default 200) | |
| `STALE_DEBATE_MINUTES` (default 60) | |
| `PREP_SECONDS` (default 30) | |
| `VOTING_WINDOW_SECONDS` (default 15) | |
| `ROUND_OPENING_SECONDS` / `_REBUTTAL_SECONDS` / `_CLOSING_SECONDS` | 300/180/180 default |
| `MAX_ARGUMENT_WORDS` (default 800) / `MAX_ARGUMENT_BYTES` (default 8000) | |
| `DISCONNECT_FORFEIT_SECONDS` (default 90) | |
| `RATELIMIT_AUTH` / `_REPORTS` / `_VOTES` / `_DEFAULT` | Default `10/min`, `20/hour`, `60/min`, `300/min`. |
| `SENTRY_DSN` (optional) | Same DSN |
| `SENTRY_TRACES_SAMPLE_RATE` / `SENTRY_ENVIRONMENT` | |
| `NODE_ENV=production` | Replaces FLASK_ENV |

**Renamed for Node convention** (set both old and new during cutover or just translate):
- `FLASK_ENV` → `NODE_ENV`
- `PORT` stays

---

## 12. Startup hooks

The Python app runs these on `create_app()`. The Next app runs equivalents in `server.ts` before binding the HTTP listener.

| Hook | Python source | Next equivalent | Status |
|------|---------------|-----------------|--------|
| Clear logs dir | [app/__init__.py:119-160](../debatethis/app/__init__.py) | n/a (Next logs to stdout) | ❌ |
| Auto-migrations (additive ALTER TABLE) | [app/_startup.py:25-66](../debatethis/app/_startup.py) | `prisma migrate deploy` runs in Docker entrypoint before `node server.ts` starts. | ⬜ |
| Achievement catalog seed | [app/services/achievement_service.py:30](../debatethis/app/services/achievement_service.py) | `await seedCatalog()` in `server.ts` startup. Idempotent. | ⬜ |
| Reset every online_status to 'offline' | [app/__init__.py:163-205](../debatethis/app/__init__.py) | Same — `await prisma.user.updateMany({ where: { online_status: { not: 'offline' } }, data: { online_status: 'offline' } })`. | ⬜ |
| Abandon orphan showcase debates | [app/__init__.py:208-251](../debatethis/app/__init__.py) | Same logic in TS. | ⬜ |
| Sweep stale LIVE debates (>60min idle) | [app/__init__.py:254-284](../debatethis/app/__init__.py) | Calls `debateService.abandonStaleDebates(60)`. | ⬜ |
| Seed missing house bots (canonical 8) | [bot_brain.py:245-296](../debatethis/app/services/bot_brain.py) | `await botBrain.seedMissingHouseBots()`. Verbatim canonical roster. | ⬜ |
| Release stuck `in_debate` house bots | [bot_brain.py:299-352](../debatethis/app/services/bot_brain.py) | `await botBrain.releaseStuckHouseBots()`. | ⬜ |

---

## 13. Deploy (Fly.io)

| Concern | Python ([fly.toml](../debatethis/fly.toml)) | Next equivalent | Status |
|---------|--------------------------------------------|-----------------|--------|
| App name during build | `debatethisnow` (production) | `debatethisnow-next` (parity test) → flip DNS later | ⬜ |
| Primary region | `iad` | Same | ⬜ |
| Internal port | 8080 | 3000 (Next default) — set `PORT=8080` env so Fly's expectation matches | ⬜ |
| Health check | GET /healthz | Same path, same Prisma SELECT 1 probe | ⬜ |
| Force HTTPS | true | Same | ⬜ |
| Auto stop/start | off / min 1 | Same | ⬜ |
| Hard / soft connection limits | 250 / 200 | Same | ⬜ |
| Strategy | rolling | Same | ⬜ |
| VM | shared-cpu-1x, 512MB | Same to start; bump to 1GB if Node + Prisma headroom needs it | ⬜ |
| Dockerfile worker | `gunicorn --worker-class eventlet -w 1` | `node server.ts` single process | ⬜ |
| Startup migrations | `python scripts/init_alembic.py && flask db upgrade` | `npx prisma migrate deploy` in entrypoint | ⬜ |

---

## 14. Tests

### 14.1 Python tests to preserve as behavior contracts

Every assertion in these files must have an equivalent Vitest/Playwright test that passes against the Next app.

| Python test file | Coverage | Next equivalent |
|------------------|----------|-----------------|
| [tests/test_hardening.py](../debatethis/tests/test_hardening.py) | Config validation, security headers, prod refusal on weak secrets, legal pages | Vitest `tests/hardening.test.ts` + Playwright security-headers check |
| [tests/test_auth.py](../debatethis/tests/test_auth.py) | Register/login/refresh/logout/delete-me, reserved names, timing equalization | Vitest |
| [tests/test_api.py](../debatethis/tests/test_api.py) | REST surface smoke tests | Vitest |
| [tests/test_sockets.py](../debatethis/tests/test_sockets.py) | Socket.IO event smoke tests | Vitest (mock socket client) |
| [tests/test_e2e.py](../debatethis/tests/test_e2e.py) | Full debate lifecycle | Playwright |
| [tests/test_endpoints_complete.py](../debatethis/tests/test_endpoints_complete.py) | Every REST endpoint exists + returns expected shape | Vitest |
| [tests/test_models.py](../debatethis/tests/test_models.py) | Model invariants (validators, helpers) | Vitest |
| [tests/test_services.py](../debatethis/tests/test_services.py) | Service-level units | Vitest |
| [tests/test_challenges.py](../debatethis/tests/test_challenges.py) | Challenge lifecycle | Vitest |
| [tests/test_achievements.py](../debatethis/tests/test_achievements.py) | All 11 predicates | Vitest |
| [tests/test_reports.py](../debatethis/tests/test_reports.py) | Report submit/list/resolve | Vitest |
| [tests/test_pages.py](../debatethis/tests/test_pages.py) | Server-rendered pages reachable | Playwright |
| [tests/test_new_endpoints_and_review.py](../debatethis/tests/test_new_endpoints_and_review.py) | Recently-added endpoints | Vitest |

### 14.2 master_test.py groups to keep green

Pointing `python scripts/master_test.py --base https://next.debatethisnow.com` at the new app must produce all-green except where the deployment legitimately can't satisfy a check.

- `public_pages` — every page reachable
- `infra` — `/healthz`, `/robots.txt`, `/ads.txt`
- `security` — required headers on HTML + JSON + 404
- `public_apis` — leaderboard, trending, languages, daily, achievements catalog
- `auth` — register → login → me → refresh → logout → delete
- `csrf` — CSRF refusal without `X-CSRF-TOKEN`
- `admin` — admin-only routes 403/404 for non-admins
- `pii` — `to_public_dict` doesn't leak private fields
- `validation` — input validation rejects junk
- `limits` — argument min/max enforced
- `blocks` — block/unblock + enforcement
- `friends` — request/accept/decline/list
- `reports` — submit + admin moderation
- `bots` — create/list/rotate/delete
- `settings` — bot picker + per-user
- `pvp` — matchmaking pair + full round
- `socket` — socket auth + room isolation
- `bot_battle` — bot vs bot showcase
- `rate_limit` — login + report budgets
- `gdpr` — delete-me

### 14.3 New Playwright suite

- Register → login → logout (cookie compat preserved)
- Send challenge → accept → land in debate room
- Full PvP round (R1 P1 submit → R1 P2 submit → R2 P1 submit → ... → vote → finalize)
- Bot battle showcase: stage → REVEAL NEXT (×6) → OPEN VOTING → finalize
- Forfeit mid-debate (both REST endpoint + 90s disconnect grace)
- Audience vote with sockpuppet dedup
- GDPR delete

---

## 15. Phase 9 new features (after cutover)

These ship AFTER parity is achieved and the Python app is archived.

| Feature | Status |
|---------|--------|
| `subscription_tier` enum on User (`free | plus | pro`) | ⏸ |
| Bot count gating: free = 2-3 bots, paid = full 8 + custom bot registration | ⏸ |
| Ad-free experience for paid tiers | ⏸ |
| Stripe checkout integration (subscriptions table to be added) | ⏸ |
| Mobile-first responsive pass on every page | ⏸ |
| Web Push notifications (channel hook is already stubbed in [notification_service.py:300-310](../debatethis/app/services/notification_service.py)) | ⏸ |

---

## 16. Hard "do not" list (compressed from prompt)

- ❌ Do not modify the existing Python codebase.
- ❌ Do not change the Postgres schema during the rewrite. (New tables allowed only for Phase 9 features.)
- ❌ Do not change the JWT secret. Cross-app cookie compatibility depends on it.
- ❌ Do not change cookie names or the `.debatethisnow.com` domain.
- ❌ Do not introduce a separate auth provider (Clerk, Supabase Auth). Auth.js with the same secrets + same OAuth credentials.
- ❌ Do not change the database (Neon stays).
- ❌ Do not skip the parity matrix.
- ❌ Do not redesign REST paths or Socket.IO event names/payloads.
- ❌ Do not rewrite blog markdown rendering — port the existing parser + ad-slot pattern.
- ❌ Do not commit `.env`. Fly secrets are the source of truth.
- ❌ Do not use `any` without a comment explaining why.
- ❌ Do not use raw `useEffect + fetch` for fetched lists — TanStack Query for every fetched list.
- ❌ Do not use raw `prisma.$queryRaw` unless a comment explains the type-safe builder couldn't express it.

---

## 17. Sign-off criteria (from prompt)

The new app is ready to take `debatethisnow.com` when ALL of these are true:

1. ⬜ `master_test.py --base https://next.debatethisnow.com` runs fully green.
2. ⬜ A real PvP debate plays through from queue to finalize without anyone touching the page outside the documented interactions.
3. ⬜ A bot-vs-bot showcase plays through to finalize.
4. ⬜ Playwright suite passes 100%.
5. ⬜ A user logged in on the Python app can flip to the next app without re-logging in (cookie cross-compat).
6. ⬜ Every checkbox in this MIGRATION_PARITY.md is ticked AND linked to the file that satisfies it.

---

## 18. Open questions / things to verify with the user

- **Twitter v2 elevated access:** is the existing client still using PKCE + synthesized-email pattern? If access was upgraded since launch, we can read real emails. (For safety, mirror the current behavior.)
- **AdSense status:** assumed off until `ADSENSE_CLIENT_ID` is set as a Fly secret. Confirm before launch.
- **Sentry DSN:** confirm whether to mirror or rotate to a new project for the Next app.
- **`debatethisnow-next` Fly app:** does it exist yet? If not, will create with `fly apps create` during Phase 8.
- **Mobile-responsive scope (Phase 9):** dashboard + debate room + matchmaking are minimum. Other pages can wait.
