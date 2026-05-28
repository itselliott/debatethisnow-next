# UI Inventory — Existing Python App

Companion to [MIGRATION_PARITY.md](MIGRATION_PARITY.md). Captured by a
structured pass over [C:\Repo\debatethis\app\static\js\](../debatethis/app/static/js/),
[C:\Repo\debatethis\app\templates\](../debatethis/app/templates/), and
[main.css](../debatethis/app/static/css/main.css). Source of truth for
recreating the UI surface in React + Tailwind + shadcn/ui.

This is a snapshot — when in doubt, read the file in the Python repo directly.

---

## JavaScript files

### `admin.js`
- **Page**: `/admin` — moderation page (reports queue + daily-topic admin + LLM toggle).
- **Sockets**: none.
- **HTTP**:
  - `GET /api/reports?status=pending`
  - `PUT /api/reports/{id}` body `{status:'dismissed'|'actioned', ban_target?:true}`
  - `GET /api/daily/topic`
  - `PUT /api/daily/topic` body `{topic, category}`
  - `GET /api/settings/all` (best-effort)
  - `PUT /api/settings/llm-scorer` body `{enabled:bool}`
- **DOM regions**: Reports list (`#reports-list`, `#report-count`), Daily topic editor (`#daily-current`, `#daily-topic-input`, `#daily-cat-input`, `#daily-set`, `#daily-clear`), LLM toggle (`#llm-state`, `#llm-on`, `#llm-off`).
- **Quirks**: 50ms `setTimeout` after DOMContentLoaded for auth hydration. Loads three sections in parallel via `Promise.all`. Per-row buttons re-wired after each `loadReports()`.

### `api.js` (global fetch wrapper)
- **HTTP verbs**: `get`, `post`, `put`, `patch`, `del`.
- Reads CSRF from cookie `dt_csrf_access` (JS-readable) and sends as `X-CSRF-TOKEN` on non-GET/HEAD/OPTIONS.
- JWT lives in httpOnly `dt_access` (NOT JS-readable).
- `credentials: 'same-origin'`. `Content-Type: application/json` by default.
- `isAuthed()` = truthy presence of CSRF cookie.
- Caches user in `localStorage['debatethis.user']`.
- Throws `Error` enriched with `.status` and `.data` on non-OK.
- Back-compat shim `token()` returns `null`.

### `auth.js` (global guard + sidebar)
- **HTTP**: `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/users/me/active-debates`.
- Public paths whitelist `['/', '/login', '/register']`; non-public + unauth → redirect to `/login`. 401/422 from `/me` → clear user, redirect.
- Adds pulsing `.nav-active-badge` to Home nav when user has in-progress debates.
- Sidebar collapse persisted to `localStorage['debatethis.sidebarCollapsed']`.
- Sound toggle label `♪ SOUND OFF` ↔ `♪ SOUND ON`.

### `bots.js` (`/bots`)
- **HTTP**: `GET /api/bots`, `GET /api/bots/mine`, `POST /api/bots`, `DELETE /api/bots/{id}`, `POST /api/bots/{id}/rotate-key`, `POST /api/bots/battle`.
- **DOM**: `#new-bot-btn`, `#bot-directory-body`, `#bot-directory-count`, `#my-bots-list`, modals `#new-bot-modal` + `#key-reveal-modal`, battle stager (`#battle-bot1`, `#battle-bot2`, `#battle-topic`, `#battle-category`, `#start-battle-btn`, `#battle-online-hint`).
- **Quirks**:
  - `parsePersona()` defensively parses bot_description (sometimes JSON `{display, style, tagline}`, sometimes plain text).
  - `online_status` values: `'online'`, `'in_queue'`, anything else = offline.
  - Native `confirm()` (not themed).
  - 500ms delay after battle staged before redirect.

### `cookie-consent.js` (global)
- Consent states: `'accepted'`, `'declined'`, `null` in `localStorage['debatethis.cookie_consent.v1']`.
- Manipulates `window.adsbygoogle.pauseAdRequests` and `requestNonPersonalizedAds`.
- 600ms delay before showing banner.

### `dashboard.js`
- **HTTP**: `GET /api/users/me/active-debates`, `GET /api/users/me/debates`, `GET /api/debates/recent`, `GET /api/debates/active`, `GET /api/matchmaking/topics`, `GET /api/daily/topic`, `POST /api/daily/queue`, `GET /api/challenges/inbox`, `POST /api/challenges/{id}/accept|decline`, `POST /api/matchmaking/queue`, `GET /api/bots`, `POST /api/bots/battle`.
- **DOM regions**: welcome header (`#welcome-name`, `#elo-num`, `#wl-wins`, `#wl-losses`, `#rank-badge`), resume card (`#resume-debate-card`, `#resume-topic`, `#resume-meta`, `#resume-btn`, `#resume-extra`), daily topic card (`#daily-topic-card`, `#daily-topic-text`, `#daily-queue-btn`), challenges (`#challenges-card`, `#challenges-list`), CTA tiles (`#start-debate-btn`, `#join-random-btn`, `#watch-bots-btn`), active debates (`#active-debates`, `#refresh-active`), trending grid (`#trending-topics`, `#suggested-topics`), past debates (`#past-debates`, `#refresh-past`), start modal (`#start-modal`, `#close-start-modal`, `#cancel-start`, `#confirm-start`, `#custom-topic`, `#custom-category`), bot-battle modal (`#bot-battle-modal`, `#bot-battle-bot1`, `#bot-battle-bot2`, `#bot-battle-topic`, `#bot-battle-category`, `#bot-battle-random`, `#bot-battle-hint`, `#bot-battle-bot1-preview`, `#bot-battle-bot2-preview`, `#confirm-bot-battle`, `#close-bot-battle`, `#cancel-bot-battle`).
- **Quirks**: reads `?topic=` and `?category=` to auto-open start modal. Modal closes on backdrop click + Esc. Past Debates falls back to global `/api/debates/recent` if user has none (prepends a note). Persona preview rendered on bot select change (`_botsById` cached on the select). Status labels: `pending → "WAITING FOR OPPONENT"`, `live → "LIVE · ROUND N"`, `voting → "AUDIENCE VOTING"`.

### `debate.js` ⚠️ THE BIG ONE
- **Page**: `/debate/{id}` — live debate room.
- **Socket emits**:
  - `join_debate` `{token, debate_id}`
  - `request_state` `{token, debate_id}`
  - `submit_argument` `{token, debate_id, content}`
  - `cast_vote` `{token, debate_id, vote_for:int}` (player id)
  - `typing` `{token, debate_id, word_count:int, active:bool}`
  - `ready_for_turn` `{token, debate_id}`
  - `leave_debate` `{debate_id}` (on `beforeunload`)
  - `advance_round_showcase` `{token, debate_id}`
  - `open_voting_showcase` `{token, debate_id}`
  - `abandon_debate_showcase` `{token, debate_id}`
- **Socket listens**:
  - `connect` / `reconnect` → emit join_debate + request_state
  - `debate_state` (s) → updates role, my_vote, spectator_count, calls applyState
  - `argument_posted` (msg) → appendMessage + hideTypingFor author
  - `opponent_typing` `{user_id, word_count, active}` → showTypingFor
  - `turn_changed` `{current_turn_user_id, round, phase, seconds_remaining, is_prep, auto}` → mutates state, plays SFX/notify on flip-to-me
  - `vote_update` `{votes_player1, votes_player2}` → updates header tallies
  - `vote_accepted` `{vote_for}` → set voted=true, render panel
  - `vote_rejected` `{reason}` → toast (reasons: `already_voted`, `participants_cannot_vote`, other)
  - `spectator_count` `{debate_id, count}`
  - `voting_open` → render vote panel + start fallback poll
  - `debate_finished` `{debate, result}` → showEndScreen
  - `debate_abandoned` `{debate_id}` → toast + redirect /dashboard after 1200ms
  - `error` `{human?, message?}` → toast + sfx.error
- **HTTP**: `GET /api/debates/{id}` (initial load + fallback poll + rich result enhancement), `GET /api/debates/{id}/my-vote`, `POST /api/debates/{id}/forfeit`, `POST /api/reports`.
- **DOM regions**: root `.debate-room[data-debate-id]` (classes toggled: `spectating`, `showcase`, `in-prep`). Intro overlay (`#intro-overlay`, `#intro-topic`, `#intro-p1-name/-elo/-tier`, `#intro-p2-...`, `.intro-round`, `#intro-countdown`). Round flash (`#round-flash`, `#round-flash-num`, `#round-flash-name`, `#round-flash-rule`). Header (`.debate-header`, `#round-pill`, `#debate-topic`, `#debate-category`, `#spectator-badge`, `#spectator-count-n`, `#share-debate-btn`, `#forfeit-btn`, `#timer`). Player cards (`#player1-card`, `#player2-card`, `#p1-name/-elo/-tier/-score/-votes/-typing/-typing-words`, same for p2; `.active` class). Turn strip `#turn-strip-cells` (6 cells R1-P1, R1-P2, R2-P1...). Transcript (`#messages` with `.msg` cards, `#jump-latest`, `#jump-count`). Prep banner (`#prep-banner`, `#prep-time`, `#ready-btn`). Composer (`#argument-input`, `#submit-argument`, `#composer-status`, `#word-count`). Showcase panel (`#showcase-panel`, `#showcase-revealed`, `#showcase-available`, `#showcase-progress-fill`, `#showcase-next`, `#showcase-prev`, `#showcase-hint`, `#showcase-round-blurb`, `#showcase-abandon`, `#showcase-abandon-btn`). Vote panel (`#vote-panel`, `#vote-close`, `#vote-title`, `.btn-vote[data-vote=1|2]`, `#vote-p1-name`, `#vote-p2-name`, `#voted-receipt`, `#voted-for-name`). Vote reopen pill `#vote-reopen`. End screen (`#end-screen`, `#end-winner`, `#end-summary`, `#end-p1/p2-name/-score/-delta`, `#round-breakdown-body`, `#rb-p1-head`, `#rb-p2-head`, `#key-moment`, `#km-who`, `#km-snippet`). Reader modal (`#reader-modal`, navigation buttons). Report modal (`#report-modal`, hardcoded radio values `harassment`/`hate`/`spam`/`threats`/`cheating`/`other`).
- **State machines / quirks** (preserve verbatim in React):
  - Module-level state vars: `socket, state, me, timerHandle, voted, myVoteFor, isSpectator, spectatorCount, votePanelDismissed, messages[], userScrolledAway, pendingNewCount, readerIndex, introShown, lastRoundSeen, typingDebounceHandle, typingLastSent, typingInactivityTimer, roundDurations, voteReceiptHideTimer, activeReportMessageId, votingFallbackPollHandle, showcaseMode, revealedCount`.
  - Socket: **`transports: ['websocket'], upgrade: false`** — explicitly WebSocket-only (HTTP long-polling broken on load-balanced Fly).
  - Timer: `setInterval(tick, 250ms)` clock. `UNLIMITED_THRESHOLD = 900` seconds → render `∞`. `HARD_CAP = 86400` (24h). Showcase shows `—`. Last 10s non-prep → `.danger` class. `is_prep` → `.prep` class. Parses `turn_deadline` as UTC (appends `Z` if missing).
  - Typing: 800ms debounce between sends, 2500ms inactivity timer fires `active:false`.
  - Smart auto-scroll: nearBottom = within 60px; pending count shows in jump pill.
  - Reader modal: `readerIndex=-1` = closed; keyboard `Esc`/`ArrowLeft`/`ArrowRight`.
  - Showcase pacing: messages buffered in DOM with `.showcase-hidden`, revealed via `revealedCount++`. Button text swaps based on `state.showcase_phase`: `speaking`/`between_rounds`/`awaiting_vote`, plus terminal `status='voting'` and `'completed'`. `SHOWCASE_ROUND_BLURBS = {1, 2, 3}` (educational copy).
  - Voting fallback poll: 3000ms interval, 60000ms max, polls `/api/debates/{id}` waiting for `status==='completed'`.
  - End screen ordering: unhide modal FIRST, then enhance with `fetchRichResult()` — previously buggy where fetch error swallowed entire reveal.
  - `MIN_WORDS = 15` for submission. `WORDS_PER_SECOND = 4` for read-time estimates.
  - Forfeit uses themed `window.ui.confirm` (danger).
  - Vote panel auto-hide receipt: 3500ms timer after vote.
  - `canQuote()`: only non-spectator, on own turn, in round 2 or 3, not in prep.
  - 1500ms fallback redirect after forfeit (to `/results/{id}`).
  - 3000ms fallback redirect after showcase abandon.

### `friends.js` (`/friends`)
- **HTTP**: `GET /api/users/search?q=...`, `POST /api/friends/request`, `GET /api/friends/requests`, `POST /api/friends/{id}/accept|decline`, `DELETE /api/friends/{id}`, `GET /api/friends`, `POST /api/challenges`.
- Search debounce: 200ms; minimum 2 chars.
- Relationship states: `'friends'`, `'outgoing_pending'`, `'incoming_pending'`, `'none'`.

### `i18n.js` (global)
- Dispatches `CustomEvent('i18n:loaded', {detail:{lang}})`.
- **HTTP**: `GET /api/i18n/{lang}`.
- DOM: `[data-i18n]`, `[data-i18n-placeholder]`, `[data-i18n-title]`; sets `<html lang>`.
- Supported: `['en', 'es']`; default `'en'`. Auto-detects via `navigator.languages` first visit. Caches in `localStorage['debatethis.lang.bundle']`. Paint from cache, then refresh.
- `setTranslatedText()` preserves child elements — updates only first text node.

### `landing.js` (`/`)
- If authed, redirect to `/dashboard`. That's it.

### `leaderboard.js` (`/leaderboard`)
- `GET /api/users/leaderboard`. 7-column table.

### `login.js` (`/login`)
- `POST /api/auth/login` body `{identifier, password}`. Server sets cookies; JS only caches user.

### `matchmaking.js` (`/matchmaking`)
- **Emits**: `join_matchmaking` `{token, topic, category}`, `leave_matchmaking` `{token}`.
- **Listens**: `queue_update`, `match_found` (toast + SFX + browser notification + 600ms redirect), `error`.
- **HTTP**: `GET /api/matchmaking/queue` (4000ms backup poll), `DELETE /api/matchmaking/queue`.
- WebSocket-only transport.
- Reads `?topic=` and `?category=` from query string.

### `notifications.js` (global)
- Opens own socket connection (WebSocket-only). Listens `notification` and global-fallback `match_found`.
- **HTTP**: `GET /api/notifications?limit=20`, `GET /api/notifications/unread-count`, `POST /api/notifications/read-all`, `POST /api/notifications/{id}/read`.
- `MAX_DROPDOWN_ITEMS = 20`. 150ms init delay. Refresh on `visibilitychange→visible`. Click outside / Esc closes.
- Notification kinds → URL map: `your_turn`/`debate_ended`/`challenge_accepted`/`rematch_offered` → `/debate/{id}`; `forfeit_received` → `/results/{id}`; `challenge_received`/`challenge_declined` → `/dashboard`; `friend_*` → `/friends`; `quest_completed` → `/dashboard`; `series_invite` → `/friends`; `report_resolved` → `/settings`.
- Icons per kind (emoji: ⚔ ✓ ✕ 🏁 🏳 ⚐ ★ ⓘ ↻ •). Relative time: "just now", `Nm`, `Nh`, `Nd`, locale date for >7d. Badge text: actual count up to 99, else `'99+'`.
- 600ms delay before global-fallback match_found navigation.

### `notify.js` (global browser notifications + title flash)
- `window.notify = { send, requestPermissionIfNeeded, reset, title }`.
- `send(title, body, {tag, titleFlash, icon, always})` — only when tab hidden unless `always`.
- Title flash interval: 900ms toggle `★ {text}` ↔ original. Reset on `visibilitychange→visible`.
- Default icon `/static/img/icon-192.png`. Default tag `'debatethis'`.

### `onboarding.js` (global first-run tour)
- One-time flag `localStorage['debatethis.onboarded.v1']`.
- Step tables keyed by path: `/dashboard`, `/debate`, `/debate-showcase` (sub-path resolved via `.debate-room.showcase` class detection), `/leaderboard`, `/friends`, `/settings`, `/bots`.
- Card width 380px, expected height 240px (used in clamp math). Reposition on resize + scroll (capture phase).
- 600ms post-DOMContentLoaded delay. Defensive `nukeOverlays()` sweeps all `.onboard-overlay` nodes.
- `window.onboarding = {reset, nuke, run}` exposed for manual control.

### `profile.js` (`/profile`, `/profile/{id}`)
- **HTTP**: `GET /api/users/{id}` (other), `GET /api/users/me/stats` + `/me/debates` (self), `GET /api/achievements/user/{id}` or `/me`, `POST /api/challenges`.
- Uses native `prompt()` for challenge (NOT themed `window.ui.confirm`). Note: This is a UX inconsistency worth fixing in the rewrite.

### `register.js` (`/register`)
- `POST /api/auth/register` body `{username, email, password}`. Server sets cookies.

### `results.js` (`/results/{id}`)
- **HTTP**: `GET /api/debates/{id}` (initial + polling).
- `WORDS_PER_SECOND = 3.0` (slower adult reading speed for review; debate.js uses 4).
- Polls every 1500ms for up to 45000ms while result is null (15s voting window + buffer).
- Stops on `status === 'completed'` or `abandoned`/`cancelled`.
- Edge cell renders `◂ +12.3` / `+5.0 ▸` / `TIE` (CSS classes `edge-left`/`edge-right`/`edge-tie`).

### `settings.js` (`/settings`)
- **HTTP**: `GET /api/i18n/languages`, `GET/PUT /api/settings/bot` (DEV only).
- DEV-only bot model section gated server-side (`#model-choices` simply not in DOM in prod).
- Re-renders entire language list after `i18n.setLanguage()`.

### `sfx.js` (global)
- All sounds procedural via `OscillatorNode` — no asset downloads.
- Muted state in `localStorage['debatethis.muted']`.
- AudioContext lazy-init; unlocked on first user interaction (`click`, `keydown`, `touchstart`).
- `window.sfx = { muted, toggle(), click, submit, error, turnChange, countdownTick, timerWarning, matchFound, win, loss, pop }`.
- Tone tables: `click` 640Hz, `submit` 440→660, `error` 330→220, `turnChange` 523→659→784, `countdownTick` 880, `timerWarning` 220, `matchFound` 523→659→784→1047, `win` 523→659→784→1047, `loss` 440→330→262, `pop` 820.

### `ui.js` (global helpers)
- `toast(message, kind)` — 3200ms duration; classes `''`/`'success'`/`'error'`/`'info'`; 250ms fade.
- `escapeHtml(s)` — replaces `& < > " '`.
- `fmtTime(secs)` — MM:SS zero-padded; coerces negative → 0.
- `copyToClipboard(text)` — `navigator.clipboard.writeText` first, fallback to hidden `<textarea>` + `execCommand('copy')`.
- `confirm(opts)` — themed promise-based dialog. Options: `title`, `message`, `confirmText`, `cancelText`, `danger`. Esc → false, Enter → true. Focuses cancel when danger; otherwise ok button.

---

## Templates

### `base.html`
- **`<head>`**:
  - `<meta name="description">` block + `<link rel="canonical">` block.
  - Google AdSense loader (conditional on `config.ADSENSE_CLIENT_ID`).
  - Fonts: preconnect to `fonts.googleapis.com` + `fonts.gstatic.com`; loads Bevan, Oswald (400/500/600/700), Lora (regular/italic 400/500/600/700), Special Elite.
  - CSS: `main.css`, `dashboard.css`, `debate.css`, `blog.css`, `ads.css`, `friends.css`, `oauth.css`.
- **Body**:
  - `.app-shell` containing `.sidebar-toggle#sidebar-toggle`, `.sidebar#app-sidebar`, `.main` (with `content` block).
  - Sidebar: `.brand` (DEBATETHIS lockup); `.nav` with `.nav-item[data-route]` for Home, Rankings, My Debates, Friends, Stats, Bot Arena, Blog, How It Works, Settings.
  - `.sidebar-footer`: notifications widget (`#notifications-widget`, `#notif-bell`, `#notif-bell-badge`, `#notif-dropdown`, `#notif-list`, `#notif-mark-all`); user-mini (`#user-mini`, `#user-mini-name`, `#user-mini-elo`, `#sound-toggle`, `#logout-btn`); `.legal-links` (Terms · Privacy).
  - `#toast-host`. Cookie consent banner (`#cookie-consent`, `#cookie-accept`, `#cookie-decline`).
- **Scripts loaded** (order matters):
  1. `cdn.socket.io/4.7.5/socket.io.min.js`
  2. `api.js`, `i18n.js`, `sfx.js`, `notify.js`, `auth.js`, `ui.js`, `onboarding.js`, `cookie-consent.js`, `notifications.js`

### `admin.html`
- Title `Admin · DebateThis`. Three `.panel` sections — Daily Featured Topic, Pending Reports, LLM Scorer. Category `<select>` has 8 hardcoded options.

### `blog_article.html`
- Server values: `title`, `description`, `date`, `tags`, `html` (full body markup), `related`, `config.ADSENSE_*` slot IDs.
- Uses Jinja `{% set %}` to inline ad HTML then `html.replace(...) | safe` to inject at marker.

### `blog_list.html`
- `.blog-grid` with `.blog-card`s. Server values: `articles[]` + `config.ADSENSE_SLOT_BLOG_INDEX`.

### `bots.html`
- `.bots-page`, `#new-bot-btn`, `#my-bots-list`, `.leaderboard-table#bot-directory-table`, `.battle-stager`, two modals (`#new-bot-modal`, `#key-reveal-modal`). Code blocks with literal `python bot.py`/pip commands.

### `dashboard.html`
- All the IDs documented under dashboard.js. Three `<select>` dropdowns with same 8-category list (Society selected).

### `debate.html`
- `.debate-room[data-debate-id]`. All the IDs documented under debate.js. Server value: `debate_id`.
- Report fieldset has 6 hardcoded radio values: `harassment`, `hate`, `spam`, `threats`, `cheating`, `other` (other pre-checked).

### `friends.html`
- `.friends-page`, search panel, `#friends-incoming-panel`, `#friends-outgoing-panel`, `#friends-list`, `#friends-count`, `#challenge-modal`.

### `how_it_works.html`
- Static `<article class="blog-article">` content explaining:
  - Scoring breakdown: length 60pts + structure 25pts + sentence-variety 15pts.
  - Audience voting: 15s window.
  - Final blend: 70% AI / 30% audience.
  - Elo formula: `expected = 1 / (1 + 10^((opponent_elo - your_elo)/400))`, K=32.
  - Rank tiers: Unranked <800, Bronze 800-999, Silver 1000-1199, Gold 1200-1399, Platinum 1400-1599, Diamond 1600-1799, Master 1800-2099, Grandmaster 2100-2399, Senator 2400+.
  - Showcase mode notes + FAQ.

### `index.html` (landing)
- Overrides `layout` block entirely — no sidebar.
- `.landing` with `.landing-bg`, `.landing-hero` (`.hero-title-debate` + `.hero-title-this`), `.landing-features` (3 cards), `.landing-foot`.

### `leaderboard.html`
- 7-column `.leaderboard-table#leaderboard-body`: #, Operative, Tier, Elo, W, L, WR.

### `login.html`
- Overrides `layout`. `.auth-shell`, `.auth-bg`, `.auth-card#login-form`. OAuth section conditional on `config.GOOGLE_CLIENT_ID`/`GITHUB_CLIENT_ID`/`TWITTER_CLIENT_ID`. OAuth icons: `G`, `⌥`, `𝕏`.

### `matchmaking.html`
- `.matchmaking`, `.mm-card` with animated `.radar` visual.

### `profile.html`
- `.profile-page[data-user-id]`, `.profile-head`, `.stat-grid` (`#stat-wins/-losses/-completed/-winrate/-peak/-streak`), `.achievement-grid#ach-grid`, `#recent-debates`, `#challenge-btn` (hidden until viewing another user).

### `register.html`
- Identical structure to login.html. Username (min 3 max 32), email, password (min 6). OAuth uses `_signup` i18n keys.

### `results.html`
- `.results-page[data-debate-id]`. Detailed result cards + per-round breakdown table + argument review + key moment panel.

### `settings.html`
- Language panel + DEV-only bot model panel (gated by `config.DEV_MODE`). `<pre class="code-block">` with literal CLI commands.

### `_ad_slot.html` (partial)
- `.ad-slot` wrapper with `<ins class="adsbygoogle">` + inline `<script>`. Server values: `config.ADSENSE_CLIENT_ID`, `ad_slot_id`, `ad_slot_format`, `ad_slot_layout`, `ad_slot_class`.

### `legal/privacy.html` and `legal/terms.html`
- `.legal-page`, `.legal-section`, `.legal-foot` CSS hooks. (Not deeply inspected — straight content port from the Python templates.)

---

## CSS — `main.css`

### Color tokens (CSS custom properties on `:root`)

**Paper / ink (vintage WPA palette)**
- `--paper: #f1e6c8`
- `--paper-2: #f7eed4`
- `--paper-3: #e6d8b0`
- `--paper-4: #d8c692`
- `--ink: #182846` (deep navy)
- `--ink-soft: #2a3f63`
- `--sepia: #6b5a36`
- `--muted: #8a7649`

**Action colors**
- `--red: #c4282e` (vintage poster red)
- `--red-dark: #9a1e23`
- `--gold: #d4a017` (mustard / Americana)
- `--gold-dark: #a87f10`
- `--navy: #182846`
- `--green: #4a7c3a`

**Aliases**: `--bg`, `--bg-2/-3/-4`, `--panel: rgba(247,238,212,0.96)`, `--panel-border`, `--text`, `--text-dim`, `--accent`, `--accent-2`, `--accent-3`, `--good`, `--bad`, `--warn`.

**Shadow + radii tokens**: `--shadow-press: 4px 4px 0 var(--ink)`, `--shadow-soft: 2px 2px 0 rgba(24,40,70,0.4)`, `--radius: 4px`, `--radius-lg: 6px`.

### Font families
- `--font-display: 'Bevan', 'Playfair Display', Georgia, serif` — h1/h2/h3, brand.
- `--font-condensed: 'Oswald', 'Arial Narrow', sans-serif` — buttons, eyebrows, nav, labels.
- `--font-body: 'Lora', Georgia, serif` — body text, inputs.
- `--font-mono: 'Special Elite', 'Courier New', monospace` — code, "empty" placeholders, badges.
- Base font-size 17px, line-height 1.5.

### Layout structure
- **CSS Grid app-shell**: `grid-template-columns: 240px 1fr`. Collapses to `0 1fr` via `.sidebar-collapsed`. Sidebar transforms `translateX(-100%)` when collapsed.
- **Sidebar**: `position: sticky; top: 0; height: 100vh; padding: 22px 18px; background: var(--navy); color: var(--paper); border-right: 4px solid var(--ink); box-shadow: 4px 0 0 var(--gold)`. Candy-stripe pseudo-element at bottom via `::after` (45deg red/paper).
- **Main**: `padding: 36px 44px; max-width: 1400px`.
- **Hamburger toggle**: `position: fixed; top: 12px; left: 12px; z-index: 50` when collapsed; moves to `left: 252px` when sidebar open.
- **Modals**: `position: fixed; inset: 0; background: rgba(24,40,70,0.55); backdrop-filter: blur(2px)`. `.modal-card { width: min(540px, 92vw); box-shadow: 8px 8px 0 var(--ink); }` + bunting `::before` (red/paper/navy 90deg).
- **Panels**: `box-shadow: 4px 4px 0 var(--ink)` letterpress. Candy-stripe `::before` (45deg red/paper).
- **Buttons**: `box-shadow: 4px 4px 0 var(--ink)`. `:hover translate(1px,1px) + shadow 3px`. `:active translate(4px,4px) + shadow 0`.
- **Inputs**: `box-shadow: 2px 2px 0 var(--ink)`. Focus `translate(-1px,-1px) + shadow 3px 3px 0 var(--red)`.
- **Toast host**: `position: fixed; bottom: 24px; right: 24px; z-index: 99`. Toasts: `border-left: 6px solid var(--navy)` (or `--red` for error, `--green` for success).
- **Landing**: Grid `1fr auto auto`, centered. Hero title responsive: `clamp(3.2rem, 11vw, 7.5rem)`. Features grid 3 cols, collapses to 1 col under 720px.

### Decorative motifs (must preserve in Tailwind)
- **Letterpress shadow**: nearly every interactive element uses a solid offset shadow `Npx Npx 0 var(--ink)`. NOT a Tailwind default — needs a custom utility (`shadow-press`, `shadow-soft`).
- **Candy stripes**: panels and modals top borders use `repeating-linear-gradient(45deg or 90deg, color 0 Npx, color2 Npx Npx)`.
- **Halftone overlay**: `body::before` is fixed-position with `background-image: radial-gradient(rgba(24,40,70,0.07) 1px, transparent 1px); background-size: 14px 14px; mix-blend-mode: multiply`. Adds aged paper texture site-wide.
- **Hero rule decoration**: 120×4 horizontal bar with gold circles at each end (`::before`/`::after`).
- **Auth-card top bunting**: 4-color repeating-linear-gradient (red/paper/navy/paper) horizontal stripe.
- **Page-header bottom border**: `border-bottom: 3px double var(--ink)`.
- **Eyebrow text**: 28×3 red bar prefix via `::before` + 0.28em letterspacing + uppercase + red.

### Other important behaviors
- `[hidden] { display: none !important }` — explicit override of any flex/grid layout (load-bearing).
- `html { color-scheme: light }` — forces light system widgets.
- `body { overflow-x: hidden; position: relative; z-index: 0 }` — hosts fixed halftone overlay.
- `select` has custom inline SVG arrow background (data URI).
- Animation `nav-badge-pulse` (1.6s ease-in-out infinite, expanding red box-shadow).
- Animation `toast-in` 0.2s slide-in.
- Onboarding: highlight uses `box-shadow: 0 0 0 9999px rgba(24,40,70,0.55)` to dim cutout around the target, plus 24px gold glow.

### Other CSS files (not deeply inspected)
- `dashboard.css` — dashboard layout (CTA tiles, topic grid, debate rows, resume card).
- `debate.css` — debate room layout (players section, transcript, vote panel, end screen, reader modal, intro overlay, round flash, turn strip, showcase panel).
- `blog.css` — blog list/article styling.
- `friends.css` — friend row + search results.
- `ads.css` — ad slot wrapper styling.
- `oauth.css` — OAuth button colors per provider.

---

## Cross-cutting things to preserve carefully

1. **CSRF + httpOnly JWT model** — every state-changing request must echo `dt_csrf_access` in `X-CSRF-TOKEN`; user object cached in localStorage as `debatethis.user`.
2. **Socket.IO must be WebSocket-only** (`transports: ['websocket'], upgrade: false`).
3. **Timer arithmetic in debate.js**: parse `turn_deadline` as UTC (append `Z` if missing); guard NaN; `UNLIMITED_THRESHOLD=900` renders `∞`; showcase renders `—`; 250ms tick.
4. **Voting fallback poll** — needed when server's finalize task drops `debate_finished`.
5. **Showcase mode state machine** with `showcase_phase` ∈ `speaking`/`between_rounds`/`awaiting_vote` plus terminal `status` flips.
6. **Onboarding tour path resolver**: `/debate/{id}` → either `/debate` or `/debate-showcase` based on `.debate-room.showcase` class detection.
7. **Argument minimum 15 words** enforced client-side (matches server).
8. **i18n cache-then-refresh**: paint from localStorage immediately, hydrate from server. Auto-detect browser language on first visit (en/es).
9. **Vote panel dismiss / reopen pill state machine** + 3500ms auto-hide receipt timer.
10. **Typing indicator throttle**: 800ms minimum between sends, 2500ms inactivity timer.
11. **Active-debate badge** on home nav (pulsing, painted by auth.js best-effort).
12. **Results polling**: 1500ms × 30 attempts (45s max) while result row is null.
13. **Notification kinds → URL map** (global socket fallback when on unrelated page).
14. **Smart auto-scroll**: 60px threshold; pending-message jump pill.
15. **All 8 categories hardcoded across templates**: Politics, Technology, Philosophy, Ethics, Economics, Science, Society, Culture (Society pre-selected by default).
16. **Letterpress shadow design language** — needs a custom Tailwind utility class.
