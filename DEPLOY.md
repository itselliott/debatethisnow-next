# Deploy + cutover walkthrough

The hands-on guide for Phase 8 of the Python → Next.js migration. Each
step has the exact command, the expected output (or what success looks
like), a "gate" — what to verify before moving on — and a rollback for
that step.

You're on Windows; commands assume PowerShell unless prefixed with
`bash$`. `flyctl` is the long form; `fly` is an alias — they're
interchangeable.

> **Total time budget:** ~60-90 minutes of active work, plus a 24-48h
> low-attention shadow window, plus 7 days of "old app stays running" insurance.

---

## Step 0 — Toolchain check (~2 min)

Open a PowerShell window at `C:\Repo\debatethisnow-next` and run:

```powershell
node --version            # need v20+, you have v24
npm --version             # any 10+ is fine
flyctl version            # need any 0.3+ for the secrets import format
flyctl auth whoami        # should print your Fly email
git status                # make sure the working tree is clean
```

**Gate:** all five commands succeed and `flyctl auth whoami` shows
your email, not an error.

**If flyctl isn't installed:**
```powershell
# PowerShell as admin
iwr https://fly.io/install.ps1 -useb | iex
# Then re-open PowerShell so PATH refreshes
flyctl auth login
```

---

## Step 1 — Validate schema parity against the live Neon DB (~5 min)

Before the first deploy, prove the hand-authored `prisma/schema.prisma`
matches what Neon actually carries. Drift here would mean a runtime
crash on the first Prisma query.

```powershell
# Set DATABASE_URL for THIS POWERSHELL SESSION ONLY.
# Replace the URL with the real Neon connection string.
$env:DATABASE_URL = 'postgresql://USER:PASS@HOST.neon.tech/DB?sslmode=require'

# Pull the live schema into a temp file
npm run db:pull

# See what changed
git diff prisma/schema.prisma
```

**Gate:**
- **No diff** → schema matches reality, you're good. Continue to step 2.
- **Small whitespace / comment diff only** → discard the diff:
  ```powershell
  git checkout prisma/schema.prisma
  ```
- **Real diff (column types, indexes, FK changes)** → commit the diff and
  inspect MIGRATION_PARITY.md § 1 to make sure the changes don't break
  the serializers. If a column was renamed in the DB but kept the old
  name in the Python ORM, the JSON API will start returning the wrong
  shape after cutover. Investigate before proceeding.

**Clear the env var so you don't accidentally bleed it into later commands:**
```powershell
Remove-Item Env:\DATABASE_URL
```

**Rollback:** none needed — this step is read-only against Neon.

---

## Step 2 — Local Docker smoke test (~10 min, OPTIONAL but recommended)

Build the production Docker image locally and confirm it boots. This
catches Dockerfile bugs before you burn a Fly deploy cycle on them.

Requires Docker Desktop running. If you don't have Docker locally, skip
to step 3 — the same build runs on Fly's builder anyway.

```powershell
# Build (5-8 min on first run, ~1 min for incremental rebuilds)
docker build -t debatethisnow-next:local .

# Run, with the DATABASE_URL for production (or a scratch Neon branch)
$env:DATABASE_URL = 'postgresql://USER:PASS@HOST.neon.tech/DB?sslmode=require'
docker run --rm -p 8080:8080 `
  -e DATABASE_URL=$env:DATABASE_URL `
  -e JWT_SECRET_KEY='a-test-secret-at-least-32-bytes-long-OK' `
  -e SECRET_KEY='another-test-secret-at-least-32-bytes-OK' `
  -e NODE_ENV=production `
  debatethisnow-next:local
```

In a **second** PowerShell window:

```powershell
curl http://localhost:8080/healthz
# Expect: {"ok":true}

curl -I http://localhost:8080/
# Expect: HTTP 200 + content-security-policy + x-frame-options headers
```

**Gate:** `/healthz` returns `{"ok":true}` (200) AND the homepage
returns 200 with security headers.

**Stop the container:** Ctrl+C in the docker run window. Clean up:
```powershell
Remove-Item Env:\DATABASE_URL
docker image prune -f
```

**Rollback:** none — local Docker doesn't touch anything live.

**Common failures here:**
- `Can't reach database server` → wrong DATABASE_URL or no `?sslmode=require`
- Build fails at `next build` → typecheck error. Reproduce with
  `npm run build` locally (no Docker) to get a cleaner error.

---

## Step 3 — Create the Fly app (~2 min)

```powershell
flyctl apps create debatethisnow-next --org personal
```

Replace `personal` with your Fly org slug if needed. List orgs with
`flyctl orgs list` if you're unsure.

**Gate:** output reads `New app created: debatethisnow-next`. If you get
"name not available," someone else owns that name — pick a different
one (e.g. `debatethisnow-rewrite`) and update `app = '...'` in `fly.toml`
to match.

**Rollback:** if you want to start over, `flyctl apps destroy
debatethisnow-next --yes`.

---

## Step 4 — Copy secrets from the Python app (~10 min)

The cookie + JWT cross-compat lives or dies here. The Next app's
`JWT_SECRET_KEY` and `SECRET_KEY` MUST equal the Python app's, or a
user signed in on one won't carry over to the other.

### 4a. Find the source of the Python app's secrets

You have one of these (whichever applies):

**(a) You have a local `.env` you used to set the Python app's secrets.**
This is the cleanest source. Skip to 4b.

**(b) You don't have the local file but the Python app is running with
the secrets set.** Dump them from inside the container:

```powershell
# SSH into a running Python machine and print env vars to a local file
flyctl ssh console -a debatethisnow -C "printenv" |
  Where-Object { $_ -match '^(DATABASE_URL|JWT_SECRET_KEY|SECRET_KEY|GOOGLE_|GITHUB_|TWITTER_|GROQ_|GEMINI_|MISTRAL_|CEREBRAS_|ANTHROPIC_|ADSENSE_|SENTRY_|RATELIMIT_)' } |
  Out-File -Encoding ascii python-secrets.env
```

Open `python-secrets.env` in an editor (notepad or VS Code) and verify
it's `KEY=VALUE` per line with no quotes. Delete any entries that
shouldn't transfer:
- `FLASK_ENV` → not relevant
- `SOCKETIO_ASYNC_MODE` → Node doesn't need it
- `PORT`, `HOST` → already set in `fly.toml`
- `PYTHONUNBUFFERED`, etc. → Python-only

### 4b. Add the two new secrets the Next app needs

Open `python-secrets.env` and append these two lines at the end (so the
Next app shares cookies across both hostnames during cutover):

```
COOKIE_DOMAIN=.debatethisnow.com
CORS_ORIGINS=https://debatethisnow.com,https://www.debatethisnow.com,https://next.debatethisnow.com
```

### 4c. Push every secret to the Next app in one shot

`flyctl` accepts `KEY=VALUE` lines on stdin and sets them all atomically:

```powershell
Get-Content python-secrets.env | flyctl secrets import -a debatethisnow-next
```

You should see a list like:
```
Secrets are staged for the first deployment.
  DATABASE_URL
  JWT_SECRET_KEY
  SECRET_KEY
  ... (one line per key)
```

### 4d. Verify the names landed

```powershell
flyctl secrets list -a debatethisnow-next
```

**Gate:** the list contains (at minimum) `DATABASE_URL`, `JWT_SECRET_KEY`,
`SECRET_KEY`, `COOKIE_DOMAIN`, `CORS_ORIGINS`. Plus OAuth + LLM keys if
those were set on the Python app.

### 4e. Delete the dump file

```powershell
Remove-Item python-secrets.env
# And clear the PowerShell history so the values aren't recoverable:
Clear-History
```

**Rollback:** secrets are easy to unset:
```powershell
flyctl secrets unset KEY1 KEY2 -a debatethisnow-next
```

---

## Step 5 — First deploy (~5 min)

```powershell
flyctl deploy -a debatethisnow-next --strategy rolling
```

This will:
1. Push your local repo to Fly's builder
2. Run the Dockerfile (deps → builder → runner, ~3 min)
3. Push the image, start a machine, wait for `/healthz` to return 200

Watch the output. You'll see (in order):
```
==> Verifying app config
==> Building image
... build output ...
==> Pushing image to fly
==> Creating release
==> Monitoring deployment
... checking health ...
Smoke checks for ... passed
v1 deployed successfully!
```

**Gate:** `v1 deployed successfully!` AND `flyctl status -a
debatethisnow-next` shows one machine, state `started`.

**Tail the logs:**
```powershell
flyctl logs -a debatethisnow-next
```

You should see the startup sequence:
```
> Ready on http://0.0.0.0:8080 (production)
[startup] seeded N new achievement(s)        # 11 on first deploy
[bot-brain] seeded N missing house bot(s)    # 0 if Python already seeded them
[bot-brain] released N stuck house bot(s)    # 0 normally
```

If you see warnings about DB connectivity or "online-status-reset
failed," double-check `DATABASE_URL` is set and includes `?sslmode=require`:
```powershell
flyctl secrets list -a debatethisnow-next | Select-String DATABASE_URL
```

**Quick sanity check:** Fly assigns a default hostname:
```powershell
curl https://debatethisnow-next.fly.dev/healthz
# Expect: {"ok":true}
```

**Rollback:** if the deploy fails or `/healthz` is 500-ing:
```powershell
# Look at the most recent release
flyctl releases -a debatethisnow-next
# Roll back one
flyctl releases rollback -a debatethisnow-next
# Or just fix the issue locally and `flyctl deploy` again — Fly's
# rolling strategy keeps the last good version serving until the new
# one passes health checks.
```

---

## Step 6 — Bind the staging hostname (~10 min, partly wall-clock for cert)

We're binding `next.debatethisnow.com` to the Next app. The apex
(`debatethisnow.com`) keeps pointing at the Python app for now.

### 6a. Ask Fly to provision a cert

```powershell
flyctl certs add next.debatethisnow.com -a debatethisnow-next
```

Output:
```
You are creating a certificate for next.debatethisnow.com
You can validate your ownership by adding the following CNAME...
```

### 6b. Add the CNAME at your DNS provider

In whatever DNS UI you use (Cloudflare, Namecheap, Route53, etc.), add:

```
Type:   CNAME
Name:   next            (creates next.debatethisnow.com)
Value:  debatethisnow-next.fly.dev
TTL:    300             (5 minutes — easier to flip later if needed)
Proxy:  off / DNS-only  (Cloudflare specifically: turn OFF the orange cloud)
```

### 6c. Wait for the cert to issue (~1-3 min usually)

```powershell
flyctl certs list -a debatethisnow-next
```

When it's ready you'll see:
```
Host                          Status                            Created
next.debatethisnow.com        Ready                             2026-05-28
```

You can also watch it directly:
```powershell
flyctl certs show next.debatethisnow.com -a debatethisnow-next
```

### 6d. Smoke-test the staging URL

```powershell
curl https://next.debatethisnow.com/healthz
# {"ok":true}

curl -I https://next.debatethisnow.com/
# Should have HSTS in prod-mode:
# strict-transport-security: max-age=31536000; includeSubDomains; preload

curl -I https://next.debatethisnow.com/api/auth/me
# 401 + x-robots-tag: noindex, nofollow, noarchive
```

**Gate:**
- `/healthz` returns `{"ok":true}`
- HSTS header present
- `/api/auth/me` returns 401 with `x-robots-tag` set

**Rollback:** if DNS is propagating slowly or the cert won't issue,
re-check the CNAME points at `debatethisnow-next.fly.dev` (note the
hyphens). If Cloudflare is involved, ensure proxy is OFF — Cloudflare's
orange-cloud breaks Fly's cert handshake.

---

## Step 7 — Run master_test.py against the staging URL (~5 min)

From the **Python repo** (`C:\Repo\debatethis`), run the existing
end-to-end test suite against the new app. The JSON shapes are
byte-compatible, so the suite should pass without code changes.

```powershell
cd C:\Repo\debatethis
python scripts/master_test.py --base https://next.debatethisnow.com
```

Expected output: per-group results, then a summary like:
```
=== Summary ===
  total : 47
  pass  : 47
  fail  : 0
  skip  : 0
```

**Gate:** all groups green except documented skips. The most likely
failures:
- `pvp` (peer-vs-peer debate) — requires two test users to play through a
  debate. If the matchmaking loop hangs, check the Next app logs for
  Socket.IO errors.
- `bot_battle` — skipped automatically if no house bots are online. If
  you set `GROQ_API_KEY`, they should be online.
- `csrf` — if any state-changing route fails CSRF, the cookie names or
  domain are wrong. Check `COOKIE_DOMAIN=.debatethisnow.com` is set.

If any group fails, fix locally, redeploy with `flyctl deploy`, and
re-run the test. Iterate until clean.

**Rollback:** none — the test is read-only beyond the test users it
creates and self-cleans.

---

## Step 8 — Manual shadow traffic (24-48h, low-attention)

The autotest doesn't catch UX bugs. You + one trusted friend should
exercise the app for real before flipping the apex.

### 8a. Sign yourself in via next.debatethisnow.com

Go to https://next.debatethisnow.com/login. If you were already signed
in to debatethisnow.com (Python app), the cookies should carry over
automatically — you should land at /dashboard without re-entering your
password.

**This is the cross-compat smoke test.** If you have to log in again,
either `JWT_SECRET_KEY`, `SECRET_KEY`, or `COOKIE_DOMAIN` doesn't match.
Don't proceed to step 9.

### 8b. Run through every flow

Working checklist:
- [ ] Play a full PvP debate end-to-end (queue → match → 3 rounds × 2
      arguments → vote → results screen). Have your friend take the other
      side.
- [ ] Stage a bot-vs-bot showcase. Click through all four spectator
      controls (REVEAL NEXT, BEGIN ROUND, OPEN VOTING, ABANDON).
- [ ] Voluntarily forfeit a live debate. Confirm the opponent's UI shows
      "X forfeited" and the result screen renders.
- [ ] Trigger the disconnect-grace forfeit (hard one): start a debate,
      close the tab in the middle of your turn, wait 90 seconds. The
      debate should auto-finalize in your opponent's favor.
- [ ] Cast an audience vote on a live debate as a spectator.
- [ ] Change your username via /settings (or the API). Confirm rate
      limiting (3 changes per year) holds.
- [ ] Send + accept a friend request between your two accounts.
- [ ] Block + unblock — confirm a blocked user can't spectate your debate.
- [ ] Hit /profile/[id], /leaderboard, /friends, /bots, /settings.
- [ ] Test on mobile (Tailwind responsiveness — the existing classes
      already cover most breakpoints).

### 8c. Watch logs for unexpected errors

In a background terminal:
```powershell
flyctl logs -a debatethisnow-next
```

Look for any `error` or 500-status responses. Rate-limit warnings are
fine; unhandled crashes are not.

### 8d. Compare behavior between Python and Next apps

Do the same flow on both apps side-by-side. Things to specifically
check are identical:
- [ ] Score after a vote-and-finalize cycle
- [ ] Elo deltas after a debate
- [ ] Achievement awards after a milestone debate
- [ ] Notification dropdown shows the same kinds with the same payloads
- [ ] Rank tier on /profile

**Gate:** 24-48h of clean traffic with no behavior divergence between
the two apps.

**Rollback:** if you find a bug, fix locally, `flyctl deploy`, and
restart the shadow window. Don't carry bugs into cutover.

---

## Step 9 — DNS cutover (~15 min, mostly wall-clock for cert)

Time to flip the apex domain. This is reversible inside one DNS TTL.

### 9a. Add the apex hostnames to the Next app

```powershell
flyctl certs add debatethisnow.com -a debatethisnow-next
flyctl certs add www.debatethisnow.com -a debatethisnow-next
```

For each, flyctl prints validation instructions. Apex (non-www) typically
needs A + AAAA records, not CNAME (DNS rules don't allow CNAME at the
apex). flyctl gives you the exact IPs.

### 9b. Add the validation records at your DNS provider

You'll add something like:
```
debatethisnow.com.    A     <fly-ip-v4>
debatethisnow.com.    AAAA  <fly-ip-v6>
_acme-challenge.debatethisnow.com.   CNAME   <fly-validation-target>
www.debatethisnow.com.   CNAME   debatethisnow-next.fly.dev
```

Use the exact values flyctl prints. **Don't repoint the existing A
records yet** — these are validation records that live alongside the
current ones. Once Fly verifies ownership it issues the cert, and only
then do you flip the production A record.

### 9c. Wait for cert validation

```powershell
flyctl certs list -a debatethisnow-next
# Both debatethisnow.com and www.debatethisnow.com should reach "Ready"
```

### 9d. Repoint the production A/AAAA records

Once certs are Ready, edit the existing apex A records at your DNS
provider:

```
debatethisnow.com.       A     <fly-ip-v4 of debatethisnow-next>   (was: fly-ip-v4 of debatethisnow)
debatethisnow.com.       AAAA  <fly-ip-v6 of debatethisnow-next>   (was: fly-ip-v6 of debatethisnow)
www.debatethisnow.com.   CNAME debatethisnow-next.fly.dev          (was: debatethisnow.fly.dev)
```

To find the Fly IPs:
```powershell
flyctl ips list -a debatethisnow-next
```

### 9e. Watch traffic shift to the new app

```powershell
# Two windows side-by-side
flyctl logs -a debatethisnow-next    # should see traffic rising
flyctl logs -a debatethisnow         # should see traffic falling
```

DNS propagation is usually 1-5 minutes with a 300s TTL but caches at
ISPs can stretch this to ~30 min. You'll see the new app's logs spike as
users' caches refresh.

### 9f. Verify cutover

```powershell
curl https://debatethisnow.com/healthz
# Compare with the apex test app's hostname:
curl https://debatethisnow-next.fly.dev/healthz
# Both should return {"ok":true} from the SAME machine

# Run master_test against the apex:
cd C:\Repo\debatethis
python scripts/master_test.py --base https://debatethisnow.com
```

**Gate:**
- `https://debatethisnow.com/healthz` → 200 served by the Next app
- master_test against the apex passes green

**Rollback (the most important rollback in this entire document):**
Repoint the apex A/AAAA records back at the Python app's IPs:
```powershell
flyctl ips list -a debatethisnow
# Set debatethisnow.com → these IPs at your DNS provider
```

You're back inside one TTL (usually 60-300s). The Next app keeps
running at next.debatethisnow.com so you can keep investigating without
taking it offline.

---

## Step 10 — Post-cutover monitoring (next ~2 hours)

Don't walk away yet.

```powershell
# Keep this running for 1-2 hours
flyctl logs -a debatethisnow-next
```

Watch for:
- Elevated 500-status responses
- Socket.IO disconnect storms
- "Can't reach database server" — Neon connection pool exhaustion
- Sustained high memory (`flyctl status -a debatethisnow-next` shows it)

If anything looks off, roll back DNS per Step 9's rollback recipe and
fix offline.

---

## Step 11 — One-week parallel run (low-attention)

Keep the Python app (`debatethisnow`) **running** for 7 days as instant-
rollback insurance. It won't receive traffic (DNS points elsewhere) but
it's online and ready to take over if cutover-Day-3 reveals a regression.

After 7 clean days:

```powershell
# Optional one final master_test before tear-down
python scripts/master_test.py --base https://debatethisnow.com

# Destroy the Python app
flyctl apps destroy debatethisnow --yes
```

Then in `C:\Repo\debatethis`, update the README to mark the repo
archive-only:

```powershell
cd C:\Repo\debatethis
# Edit README.md to add at the top:
#   > Archived 2026-XX-XX. The live app now runs from
#   > C:\Repo\debatethisnow-next.
```

---

## Step 12 — Phase 9 work starts

With cutover stable, open the Phase 9 backlog:
- Subscription tiers + Stripe checkout (`subscription_tier` enum on User)
- Mobile-first responsive pass
- Web Push notifications (the notification-service `push` channel
  already has the call site stubbed)

Plus the Phase 5 carryovers any time you want them:
- OAuth (Google/GitHub/Twitter) — the existing login UI already
  conditionally renders buttons, so the wiring just needs to land
- Blog markdown rendering (27 articles to port)
- /how-it-works + /terms + /privacy static pages
- Tutorial overlay (≥20 cards across 7 surfaces, per the parity matrix)
- Cookie consent banner
- Per-message reader modal in the debate room

---

## Common errors + fixes

### "DATABASE_URL is missing sslmode for a non-localhost host" at startup
The Next app refuses to boot in prod without it.
```powershell
flyctl secrets set DATABASE_URL='postgresql://...?sslmode=require' -a debatethisnow-next
```

### Cookies don't share between debatethisnow.com and next.debatethisnow.com
`COOKIE_DOMAIN` is wrong or missing. It must START WITH A DOT:
```powershell
flyctl secrets set COOKIE_DOMAIN='.debatethisnow.com' -a debatethisnow-next
flyctl deploy -a debatethisnow-next
```

### POST /api/auth/login returns 403 csrf_failed
The CSRF header isn't being echoed. In DevTools → Application → Cookies,
confirm `dt_csrf_access` exists for the right domain. If it does, the
client `fetch` isn't including it. The Next app's `api-client.ts` reads
it automatically; if you're testing with curl, add:
```powershell
curl -X POST https://next.debatethisnow.com/api/auth/login `
  -H "Content-Type: application/json" `
  -H "X-CSRF-TOKEN: <value-from-dt_csrf_access-cookie>" `
  --cookie "dt_csrf_access=<value>; dt_access=<value>" `
  -d '{"identifier":"x","password":"y"}'
```

### House bots show "offline" in the picker
The brain keys aren't set or are stale.
```powershell
# Confirm at least one brain key is present (this won't print the value)
flyctl secrets list -a debatethisnow-next | Select-String -Pattern 'GROQ|GEMINI|MISTRAL|CEREBRAS'
```
If missing, set them per Step 4. Without ANY brain configured the bots
fall back to canned templates — still functional, just less varied.

### `flyctl deploy` builder error: "context deadline exceeded"
Fly's builder timed out. Re-run; it's usually a transient. If it happens
twice, the build itself might be slow (Node 24-slim is fine; if you've
added a heavy native dep, prebuild it).

### Health check failing post-deploy
The check probes `/healthz` every 30s with a 5s timeout. If Neon is slow
to respond, the check fails. Loosen the timeout in `fly.toml`:
```toml
[[http_service.checks]]
  interval = '30s'
  timeout = '15s'        # was 5s
  grace_period = '30s'   # was 20s
```
Then `flyctl deploy`.

### "Unhealthy" status in `flyctl status` but logs look fine
The machine started but `/healthz` returned non-200 during the grace
period. Look at the logs directly with:
```powershell
flyctl logs -a debatethisnow-next --no-tail
# Then filter for the startup-hook output
```

### Memory pressure
1GB is the budget. If `flyctl status -a debatethisnow-next` shows
sustained >900MB:
```toml
# fly.toml
[[vm]]
  memory = '2gb'
  memory_mb = 2048
```
Then `flyctl deploy`.

---

## Quick command index

| What I want to do                  | Command                                            |
|------------------------------------|----------------------------------------------------|
| See the Next app's status          | `flyctl status -a debatethisnow-next`              |
| Tail logs                          | `flyctl logs -a debatethisnow-next`                |
| SSH into the running container     | `flyctl ssh console -a debatethisnow-next`         |
| List secrets (names only)          | `flyctl secrets list -a debatethisnow-next`        |
| Set a secret                       | `flyctl secrets set KEY='value' -a debatethisnow-next` |
| Unset a secret                     | `flyctl secrets unset KEY -a debatethisnow-next`   |
| Deploy                             | `flyctl deploy -a debatethisnow-next`              |
| Roll back one release              | `flyctl releases rollback -a debatethisnow-next`   |
| List custom hostnames              | `flyctl certs list -a debatethisnow-next`          |
| List Fly's IPs for the app         | `flyctl ips list -a debatethisnow-next`            |
| Restart the machine                | `flyctl machine restart -a debatethisnow-next`     |
| Open the dashboard in a browser    | `flyctl open -a debatethisnow-next`                |
