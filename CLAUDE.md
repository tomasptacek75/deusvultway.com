# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

POC (proof of concept) for a strength-training coaching business run by David (BloodAndGuts). A marketing landing page plus a trainer/client portal: David assigns clients workouts (exercises/sets/reps/weight), writes nutrition plans, and clients log what they actually did, track bodyweight/measurements, and set goals. Domain `bloodandguts.cz` is live and this POC is currently deployed there.

This project deliberately mirrors the architecture of the sibling project `../Kamata.cz` (same developer, same hosting provider) — when in doubt about a pattern, check how Kamata.cz solved it before inventing something new.

## Commands

Frontend (`frontend/`):
- `npm run dev` — Vite dev server on port 5310, proxies `/api` to `http://localhost:8310`
- `npm run build` — builds directly into `../php-forpsi/public` (this is the deploy artifact, not a separate `dist/`)
- `npm run lint` — oxlint

Backend (from repo root or `php-forpsi/public/`):
- `start-backend.bat` — `php -S localhost:8310 router.php`, serves the PHP API via the built-in server (router.php forwards `/api/*` to `api/index.php`, and points it at the local `src/` since prod and local layouts differ)

Both dev servers together: run `start-backend.bat` and `start-frontend.bat` (repo root) in separate terminals, then open `http://localhost:5310`.

Deploy to production (`bloodandguts.cz`, Forpsi shared hosting):
1. `cd frontend && npm run build`
2. `python _ftp_deploy.py` (from repo root) — uploads `php-forpsi/public` → `/www` **and** `php-forpsi/src` → `/www/src` (both are required; the API won't run with only `public/` uploaded). FTP credentials come from the gitignored `_ftp_credentials.py` (template: `_ftp_credentials.example.py`).

Deploy to test (`test.bloodandguts.cz` — same Forpsi account, subdomain already provisioned, DNS resolves):
1. `cd frontend && npm run build` (same build serves both — `VITE_API_URL` is relative `/api`, no `.env.test` needed)
2. `python _ftp_deploy_test.py` (from repo root) — same upload shape as production but targets `/subdoms/test` instead of `/www`. Test has its own SQLite DB (seeds itself on first request) and never shares data with production. Use this domain for trying out new/risky changes before they go to `_ftp_deploy.py` → production. Vite's `emptyOutDir: false` means old hashed asset files accumulate in `php-forpsi/public/assets/` across builds — clear stale ones (both locally and on whichever remote target you deployed to) before/after a build if `index.html`'s referenced hashes no longer match what's sitting there.

**Gated deploy (added 2026-07-24) — use this instead of the two manual steps above for anything going to production:**
```
python deploy_gated.py
```
Runs, in order: `npm run build` → `_ftp_deploy_test.py` → the Playwright e2e suite in `e2e/` against `test.bloodandguts.cz` → only if every test passes, `_ftp_deploy.py` (production). If the e2e run fails, production is **not** touched — it stays on the previous working build, and the failing build stays live on test for inspection (`e2e/playwright-report/index.html` has the failure detail). Flags: `--skip-build` (build already done), `--keep-going` (deploy to production anyway despite e2e failures — emergency use only). First-time setup for the e2e suite: `cd e2e && npm install && npx playwright install --with-deps chromium` (see `e2e/README.md`). This exists because David won't have time to manually click through the app before every deploy, and an accidentally broken production is a reputational risk to both David and Tom (David's clients are potentially Tom's clients too) — see "Automated e2e test gate" below.

A Playwright e2e suite now exists in `e2e/` (Node/Playwright, separate `package.json` from `frontend/`) covering both trainer and client sides — see `e2e/README.md` for what each spec covers and design notes (serial execution, API-based setup/teardown, `E2E`-prefixed disposable test data). No PHPUnit or other backend-only test suite exists yet.

## Architecture

**Split repo, single deploy artifact.** `frontend/` is a React 18 + Vite + Tailwind v3 SPA. `php-forpsi/` is the PHP backend *and* the production webroot: `vite build` writes straight into `php-forpsi/public/`, so after a build that directory contains both the compiled SPA and the PHP API side by side. `php-forpsi/src/` (PHP source: `bootstrap.php`, `db.php`, `config.php`) sits *outside* `public/` locally, but on the Forpsi server it gets uploaded to `/www/src` — a sibling of the webroot — and is blocked from direct HTTP access via `.htaccess` (`Require all denied`), same for `/www/data` (SQLite file).

**Backend is vanilla PHP 8, no framework.** Everything routes through one file, `php-forpsi/public/api/index.php`: it parses the URI into `$path`/`$seg` and does sequential `if ($method === 'X' && $path === 'Y')` checks ending in a 404 fallback. `src/bootstrap.php` provides the shared primitives — `jsonResponse()`/`jsonInput()`, a dependency-free HS256 JWT implementation (`jwt_create`/`jwt_verify`), and `requireAuth()`/`requireRole()` guards. `src/db.php` provides `db()` (PDO singleton), `fetchOne`/`fetchAll`/`insertRow` helpers, and `initSchema()`.

**Database is SQLite, not MySQL** — deliberately. `journal_mode = DELETE` (not WAL) because Forpsi's shared/networked filesystem doesn't reliably support WAL's shared-memory locking (this corrupted a production DB on a sibling project once). `initSchema()` runs on every request and is where schema, seeding, and migrations all live. The `CREATE TABLE IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS` block at the top always runs unconditionally (genuinely cheap — a fresh DB needs it, and an existing one just no-ops via `sqlite_master`). **Everything after that — the `ALTER TABLE ADD COLUMN` calls and any seed/backfill function — is gated behind a `PRAGMA user_version` check and only actually executes once, ever:**
```php
$schemaVersion = (int) $pdo->query('PRAGMA user_version')->fetchColumn();
if ($schemaVersion < 1) {
    // ALTER TABLE ..., seedXyz($pdo), backfillXyz($pdo), ...
    $pdo->exec('PRAGMA user_version = 1');
}
```
This replaced an earlier design where that whole block ran unconditionally on every request — by 2026-07-24 it had grown to ~15 always-caught `ALTER TABLE` exceptions plus several per-row seed/backfill loops (~70+ queries checking data that almost always already existed), adding a measured ~300–500ms to *every single API call* (confirmed by timing a 404 route, which paid the same tax as a real endpoint). Fixed once discovered; client-switching in the trainer UI dropped from ~1s to ~150ms. **Convention for schema changes now:** add the `CREATE TABLE` shape for fresh installs (outside the gate), and put the matching `ALTER TABLE`/backfill call *inside* the existing `if ($schemaVersion < 1)` block if it hasn't shipped yet, or — if `user_version` has already been bumped past what your change needs — add a new `if ($schemaVersion < 2) { ...; $pdo->exec('PRAGMA user_version = 2'); }` block instead of stuffing it into the old one (which will never run again on already-migrated databases). Check the current `user_version` bump number in `db.php` before deciding which block to use.

**Auth is intentionally passwordless right now.** `POST /api/auth/demo-login {user_id}` issues a JWT for any active user — no password check at all. This is a deliberate POC decision (not a bug), scoped to this early phase where only demo/known users exist; email+password with reset is planned but not built. **Do not silently "fix" this to require a password** — if real auth is needed, that's a scoped follow-up task, not a bugfix.

**Demo/seed data uses two functions, both called from `initSchema()`:**
- `seedDemoData()` — only runs once, gated on `users` table being empty. Creates the trainer (David) and three demo clients plus exercises/workouts/goals/metrics/nutrition for the first client.
- `seedAdditionalClientData()` — runs on every request but is idempotent *per client*: it skips any client who already has at least one workout row. This exists because `seedDemoData()` had already run once in production (creating the 3 users) before the other two clients' demo data was written — it backfills demo data for clients who don't have any yet, without ever overwriting a client's real data. Follow this same "skip if data already exists" pattern for any future backfill, since production already has a mix of seeded and real user-entered data.

**Frontend routing is role-gated.** `App.jsx` defines `/trainer/*` and `/client/*` route trees, each wrapped in `<ProtectedRoute role="...">` (checks the JWT-derived role stored in `localStorage` via `src/api/client.js`) and rendered inside `<AppShell links={...}>` (top nav bar + mobile hamburger menu — the nav must stay in the `hidden md:flex` / mobile-drawer split established in `AppShell.jsx`, a horizontally-overflowing header was a real bug once). `src/api/client.js` is the single axios instance: it attaches the bearer token, and on 401 clears storage and redirects to `/login`.

**SEO is deliberately blocked site-wide right now**: `public/robots.txt` disallows everything, and `public/.htaccess` sets `X-Robots-Tag: noindex, nofollow` on every response, plus `<meta name="robots" content="noindex,nofollow">` in `index.html`. This is a temporary state (David hasn't approved public launch yet) — don't remove it without being asked.

**The app is installable to the iOS home screen** (added 2026-07-23): `public/manifest.json` + `apple-touch-icon.png`/`icon-192.png`/`icon-512.png` (generated from the existing red-dumbbell brand mark, rendered onto a `#0a0a0a` square — no image-conversion tool was available, so these were produced by screenshotting an HTML template with Playwright/Chromium at each target size) + the `apple-mobile-web-app-*` meta tags and `viewport-fit=cover` in `index.html`. Because `viewport-fit=cover` lets content draw under the iOS status bar/notch, any element that sits flush against the top of the viewport (sticky or not) needs `pt-[env(safe-area-inset-top)]` — already applied to `AppShell.jsx`'s sticky header, `Landing.jsx`'s header, and `Login.jsx`'s outer container; add it to any new top-of-page element too, or it'll render unclickable under the notch on real notched devices (this doesn't show up in ordinary Chromium-based local testing — `env(safe-area-inset-top)` only resolves to something nonzero in real WebKit/Safari). The `"/"` route also now redirects already-authenticated users straight to `homePath()` instead of showing `Landing`, so the home-screen icon opens into the app rather than the marketing page.

**A "vertically centered" page is not a permanent exemption from the safe-area rule above.** `Login.jsx` was originally skipped (its `min-h-screen flex items-center justify-center` meant content never touched the top edge) — until the client picker list grew past one screen's height (23 demo clients) and started overflowing, at which point the flex-centering stopped protecting the top and the same notch-overlap bug came back. Any full-page container is a candidate for the safe-area padding regardless of whether it looks centered *right now*, since content that fits today can grow later. `Login.jsx` now has `py-6 pt-[calc(1.5rem+env(safe-area-inset-top))]` for exactly this reason — keep that pattern if similar overflow-prone centered pages show up elsewhere.

**Both sticky headers (`Landing.jsx` and `AppShell.jsx`) use a fixed-height inner row (`h-14`) and a translucent background (`bg-neutral-950/95`) — both are deliberate, keep them matched.** When a "too much space below the header" complaint comes up, check the header's own fixed height first, not the padding on the section below it — on 2026-07-24 several rounds of shrinking the hero section's `pt-*` (64px→32px→8px) had no visible effect because the header itself (`h-20`/80px on Landing, `h-16`/64px on AppShell, plus `env(safe-area-inset-top)` on top) was the actual dominant space; shrinking both headers to `h-14` fixed it immediately. Separately, the translucent background is an explicit user preference (confirmed 2026-07-24 after briefly making it opaque while chasing an unrelated visual artifact) — don't make these headers fully opaque.

**Workout times use a custom `TimeSelect` component, not `<input type="time">`.** `frontend/src/components/TimeSelect.jsx` renders two `<select>`s (hour 07–21, minute 00/15/30/45) instead of a native time input — mobile Safari doesn't reliably enforce `step`/`min`/`max` on the native picker (the wheel still scrolls the full 24h regardless), so a `<select>` is used instead since it can only ever offer the exact options given. Picking an hour defaults the minute to `:00` for morning hours (<12) or `:45` for afternoon/evening (≥12), resetting each time the hour changes. Reuse this component for any future time-entry field instead of reaching for `<input type="time">` again.

**Calendar auto-groups same-time workouts into one entry ("group sessions").** `CalendarView.jsx` groups each day's items by `time` (`groupByTime()`) before rendering — if two+ clients share the exact same date+time, they render as one row/chip with all client names joined and avatars stacked, instead of duplicate rows. `TrainerCalendar.jsx`'s render functions branch on `w.members.length > 1`; editing the time on a grouped entry updates every member together. There's no explicit "team session" object in the schema behind this — it's purely a display-layer grouping of individually-owned `workouts` rows that happen to share a timestamp, so seed/demo data that wants to look like a coherent group class needs to intentionally give those rows the same `title`/`location` too (see `seedJulyAugustDemoSchedule`'s shared-slot-pool approach for the pattern).

**Sessions are assumed to be exactly 60 minutes** (`SESSION_LENGTH_MIN` in `frontend/src/utils/schedule.js`) — there's no duration field on `workouts`, just a start `time`, so "is this in progress right now" and "does this new time collide with an existing booking" both derive the end time as `time + 60min`. `findScheduleConflict({ date, time, excludeWorkoutId })` (same file) checks a day's full `GET /schedule` for any other client's workout whose 60-minute window overlaps the candidate time — exact-same-start-time is excluded (that's an intentional group session, not a conflict) — and is wired into every place a trainer sets a workout's time (`TrainerCalendar.jsx`'s inline time editor, `ClientDetail.jsx`'s create-workout form and inline time/location editor) as a `window.confirm()` soft warning, not a hard server-side block. If a new time-editing surface gets added later, wire this same check in or double-booking silently goes unwarned.

**Deploying to production is currently pre-authorized.** The user asked (2026-07-21) to deploy every change straight to `bloodandguts.cz` without asking first, until told otherwise. As of 2026-07-24 this should go through `python deploy_gated.py` (build → test deploy → e2e suite → production, only on green) rather than the two old manual commands directly — same pre-authorization, just with an automated safety gate in front of it now (see "Gated deploy" under Commands, and "Automated e2e test gate" below). Re-confirm this is still wanted if it's been a while or the ask seems to have changed.

**Automated e2e test gate (added 2026-07-24).** Tom (the developer, working with Claude in Cowork) asked for something equivalent to the automated pre-deploy checks used on the sibling project — David won't have time to manually click through the app before every deploy, and Tom didn't want an accidental production break to become a reputational problem, since David's clients are potentially Tom's own clients too. `e2e/` is a standalone Playwright suite (own `package.json`, not part of `frontend/`) that drives the real, running app — both trainer and client sides — against `test.bloodandguts.cz`; it does not test against a local build or mock the API. `deploy_gated.py` wires it into the deploy flow: production only gets the new build if every e2e test passes against test first. See `e2e/README.md` for the full list of what's covered (auth/role-gating, exercise library, client detail tabs, calendar, teams/training-plans/block generation, client workout logging, progress/photos/nutrition/billing, messaging/notifications, EN/CS toggle) and design notes (why `workers: 1`, why most specs log in via `localStorage` injection instead of clicking through `/login`, why generated test data is prefixed `E2E` and mostly self-cleans via API calls in `afterEach`). If a new feature/page gets added, add a matching spec here — this suite is the only thing standing between "trainer clicks around a bit after deploy and hopes" and "deploy actually got checked."

## Current status / known gaps (as of 2026-07-23)

- Landing page pricing tiers (990/1690/2690 Kč) are placeholder content — David needs to supply real tier names, prices, and feature lists.
- Exercise videos are a placeholder (`exercises.video_url`, manually pasted URL e.g. an unlisted YouTube link) — no upload pipeline built yet.
- One test contact-form submission ("Deploy Test" / deploytest@example.com) exists in the production `inquiries` table from deploy verification. There's no delete endpoint for inquiries yet.
- Real password-based auth + reset flow is not built (see "Auth" above) — schema (`users.password_hash`) is ready for it.
- SSL on `bloodandguts.cz` had an expired-certificate error on first deploy that resolved itself (Forpsi's own renewal) within the same session — not something fixed via this repo, just noting it happened in case it recurs.
- EN/CS language toggle (flag icon in `AppShell`, see `frontend/src/i18n/LanguageContext.jsx`) now covers every page in both the trainer and client apps — completed and deployed to both test and production 2026-07-23. Backend error strings (`jsonResponse(['detail' => ...])`) and seeded demo *content* (exercise names/cues, nutrition notes) remain Czech-only by design — that's real/simulated training content, not UI chrome, and out of scope for this toggle.
- **Production has 23 demo clients, not just the original 3** (as of 2026-07-24) — `seedExtraDemoClients()`/`seedJulyAugustDemoSchedule()`/`backfillDemoPhones()` in `db.php` added 20 more named Czech clients plus a July/August 2026 demo schedule (times, phone numbers, fitness-emoji avatars) purely to showcase calendar features. Don't mistake this bulk of clients for real signups — see the memory note for full detail if you need it, this is just a flag so it doesn't look like unexplained data drift.

**As of 2026-07-23, `bloodandguts.cz` (production) has feature parity with `test.bloodandguts.cz`.**
The full coaching-platform spec (training blocks/mesocycles, exercise library categorization, team
programming, RPE/%1RM auto-progression, 1RM tracking, PR/history, exercise & workout comment
threads, in-app chat, notifications, manual-entry subscriptions/payments, progress photos,
body-weight/1RM charts, offline set-logging queue, GDPR data export, EN/CS language toggle) was
built out and verified on test first, then the same build was deployed to production the same day
— both environments now run the same frontend build and backend `src/`, each against its own
SQLite DB. Known scope gaps below apply to both environments equally, not hidden, by design:
- **Payments (T6)** — no payment-gateway account/API keys exist (GoPay/Comgate/Stripe or similar).
  `subscriptions`/`payments` tables + trainer UI exist, but money is recorded manually after the
  trainer receives it elsewhere — there's no online checkout. Needs David to open a merchant
  account before this can go further.
- **Realtime (S1)** — Forpsi shared hosting has no WebSocket server. "Realtime" is 15–20s polling
  (`NotificationBell.jsx`, `Messages.jsx`) — functionally equivalent for this scale, just not push.
- **Video annotation (T5)** — no video upload/hosting infra exists (`video_url` is still just a
  pasted link). Feedback is timestamped text comments (`exercise_comments`/`workout_comments`
  tables, `CommentThread.jsx`), not drawing/annotating on the video itself.
- **Offline mode** — `frontend/src/offlineQueue.js` queues failed set-log POSTs in `localStorage`
  and flushes on reconnect (with server-side idempotency via `exercise_logs.client_ref`). This is
  not a full PWA — no service worker, no offline app-shell caching, just the one write path that
  actually matters mid-workout.
- Team/plan generation (`POST /plan-blocks/{id}/generate-workouts`) rounds `percent_1rm` target
  weights to the nearest 2.5 kg and requires the trainer to have recorded at least one 1RM for a
  client/exercise pair beforehand — otherwise it generates the set with no target weight (client
  fills it in, same as a manual-progression block).
