# ScholarPortal Complete Test Plan

Use this after applying the database migrations and deploying Edge Functions to a **staging** Supabase project. The IDs match `docs/IMPLEMENTATION_CHECKLIST.md`.

## Test accounts you should create

Create separate accounts so permission tests are meaningful:

```text
student-a@example.com      normal user
student-b@example.com      normal user
counselor@example.com      counselor plan
sponsor@example.com        sponsor plan
staff@example.com          app_metadata.role = staff
admin@example.com          app_metadata.role = admin
```

Use Stripe test-mode subscriptions or temporarily create staging `subscriptions` rows through the admin panel to exercise plan-gated features.

## A. Preflight / build

### T00 — Source and production build

```bash
python scripts/verify_release.py
npm ci
npm run lint
npm run build
npm run preview
```

Expected:

- release verifier ends with PASS;
- lint has no blocking errors;
- Vite build completes;
- preview loads without console exceptions.

Run the remaining tests against the built/staging version, not only the development server.

---

# AI, research and verification

### T01 — AI calls are server-side

1. Open browser DevTools → Network.
2. Run a Copilot generation.
3. Confirm the browser calls your Supabase `functions/v1/ai-gateway` endpoint.
4. Inspect built JS/network headers.
5. Confirm no CGU/Groq/OpenAI/Gemini secret appears in browser source/local storage/network request payload.

Also run:

```bash
rg -n "VITE_(CGU|GROQ|OPENAI|GEMINI)_API_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY" src
```

Expected: no matches.

### T02 — AI gateway requires authentication

Call `ai-gateway` without an Authorization header.

Expected: 401/Unauthorized; no AI request and no `ai_usage` row.

### T03 — 4 AI-provider fallbacks

Test each provider independently in staging.

1. Configure only CGU; invoke Copilot; provider should be `cgu`.
2. Remove/invalid CGU and configure only Groq; provider should be `groq`.
3. Remove/invalid first two and configure only OpenAI; provider should be `openai`.
4. Remove/invalid first three and configure only Gemini; provider should be `gemini`.
5. With all four valid, deliberately make CGU fail and verify response/agent log `attempts` shows fallback.

Do this for both:

- Edge Function AI (`/copilot`), and
- Python agent AI (`python Agent/agent.py`) in a controlled staging project.

### T04 — Admin AI kill switch

1. Admin → Platform Settings → `ai`.
2. Set `enabled` to `false`.
3. Try Copilot.

Expected: clear 503-style “AI features disabled” message; no provider is charged.

Restore `enabled:true`.

### T05 — AI generation history switch

1. Set `ai.save_generation_history=false`.
2. Generate a Copilot draft.
3. Confirm `ai_usage` increments but no new `ai_generations` row is created.
4. Set it back to true and confirm history is saved again.

### T06 — AI credit quotas

1. Use a Free-plan user.
2. Note monthly allowance under `/pricing`/database `plans`.
3. Generate actions until the remaining credits are below the next action cost.
4. Attempt another generation.

Expected: request is blocked with `quota_exceeded`; credits cannot be bypassed by editing the frontend.

### T07 — Research Agent uses actual search

Run in staging with `FACEBOOK_PUBLISH_ENABLED=false`:

```bash
python Agent/agent.py
```

Inspect `agent_events` and `agent_runs`.

Expected: search provider results are recorded, source URLs are real HTTP(S) URLs, and candidates are fetched before publication.

### T08 — Search fallback chain

Run controlled tests:

1. Serper valid → expect Serper.
2. Serper missing/invalid + Tavily valid → expect Tavily.
3. First two missing/invalid + Bing valid → expect Bing.
4. All three API keys missing → expect DuckDuckGo HTML fallback.

Confirm provider name in agent events. The no-key fallback should produce canonical destination URLs rather than DuckDuckGo redirect URLs.

### T09 — Verification fetches source page

For a known official scholarship page:

1. Run the research/verification pipeline.
2. Inspect `opportunity_sources` and `opportunity_verifications`.

Expected: final URL, HTTP status, hash, fetch strategy, checks and confidence are stored.

### T10 — 4 source-fetch fallbacks

`FetchCascade` attempts:

```text
normal request
browser-header request
cache-busting request
Jina Reader
```

To test safely, use controlled URLs/test endpoints that cause specific earlier strategies to fail. Inspect the returned/stored `fetch_strategy`. Do not intentionally attack third-party sites.

### T11 — Official-source gate

Test three candidate URLs:

1. recognized `.edu/.ac/.gov` institution page;
2. organization-matching official corporate/foundation domain;
3. known aggregator/SEO listing.

Expected: first two may pass the official-source check; aggregator must not auto-publish as verified.

### T12 — Human review queue

1. Lower-quality/uncertain source should create a pending `opportunity_review_queue` row.
2. Sign in as normal user: `/quality` must be inaccessible.
3. Sign in as staff/admin and open `/quality`.
4. Approve/reject an item.

Expected: status changes and an `admin_audit_logs` entry is written.

### T13 — Provenance and verification history

After a verified opportunity is inserted, confirm:

```sql
select * from opportunity_sources where opportunity_id='OPPORTUNITY_UUID';
select * from opportunity_verifications where opportunity_id='OPPORTUNITY_UUID';
```

Expected: at least the source/verification records corresponding to the published item.

### T14 — Opportunity change monitoring

1. Use a staging opportunity whose source page you control.
2. Run pipeline once.
3. Change a meaningful field/deadline on the source page.
4. Run monitor again.

Expected:

- `opportunity_versions` receives snapshot/hash/changed fields;
- opportunity updates only if re-verification remains safe;
- otherwise the item moves into review/change-needs-review;
- watchers receive change notification once, not repeatedly.

### T15 — Program discovery

Run the program research portion through the agent pipeline.

Expected: only verified program candidates are published to `programs`; uncertain programs do not receive a verified presentation.

### T16 — Program change monitor

Repeat T14 for a controlled degree-program page.

Expected: updated check time/hash/verified fields; unsafe changes require review rather than silent trust.

### T17 — Trust thresholds

Admin → Platform Settings → `trust`.

1. Raise opportunity auto-publish threshold to 99.
2. Run agent against a normal candidate.
3. Confirm borderline result queues rather than auto-publishing.
4. Restore intended threshold (default 88).
5. Repeat for `program_auto_publish_min_confidence` (default 80).

---

# Student profile and matching

### T18 — Structured student profile

Create/edit a profile and save:

- citizenship;
- desired countries;
- desired degree;
- GPA + scale;
- English test + score;
- budget + currency;
- research/skills/education.

Reload the page and verify values persist.

### T19 — Deterministic eligibility precedes AI explanation

Create a test opportunity with a hard rule (for example Master only or minimum GPA) and two profiles:

- one that meets the rule;
- one that clearly fails.

Run Match.

Expected: failing profile returns `eligible:false`/score capped below the normal range; AI text may explain the failure but cannot override it.

### T20 — Stored match score

After matching, query/admin-view `user_match_scores`.

Expected fields include eligibility, score, eligibility/relevance/competitiveness components, matched rules/warnings, explanation and calculation time.

### T21 — Degree Program Matcher

Open `/programs`, select a profile and inspect fit.

Change profile inputs to exercise:

- country preference;
- level;
- field/background;
- budget;
- GPA;
- citizenship;
- language score.

Expected: fit/reasons/blockers change deterministically. No admission guarantee is shown.

---

# Watchlists / notification system

### T22 — Opportunity watchlist

From Intelligence/opportunity UI, watch an opportunity and enable change/deadline alerts.

Expected: own row appears in `user_watchlists` and reload preserves it.

### T23 — Watchlist plan limit

Use a plan with a small `max_watchlists` value and add one beyond the limit directly through UI/API.

Expected: database enforcement rejects it even if UI controls are bypassed.

### T24 — Delivery ledger + deduplication

Trigger the same notification event twice.

Expected: only one logical `(user, channel, delivery_key)` delivery persists; repeated pipeline execution does not spam the same event.

### T25 — In-app notification center

Open `/notifications`.

Expected:

- watchlist/deadline/delivery events display;
- unread count displays;
- Mark read and Mark all read update `read_at`.

### T26 — Digest frequency

Create three users/settings: daily, weekly, monthly.

Run notification agent on controlled dates or temporarily inject test dates in staging.

Expected: opportunity digest cadence follows each preference.

### T27 — Watchlist timing is independent of digest

Set a user to monthly digest, watch an opportunity and cause a watched change/deadline event.

Expected: watchlist event is still processed daily; user does not wait until monthly digest.

### T28 — Multi-select alert targeting

Settings → choose multiple countries/levels/fields, save, reload.

Seed recent opportunities that match and do not match.

Expected: digest includes relevant combinations and ignores clear non-matches.

### T29 — Deadline reminders

Watch an opportunity with deadline at one configured reminder distance (e.g. 7 days).

Expected: one deadline reminder is created per delivery key, not every run.

### T30 — Admin notification settings

Admin → Platform Settings → `notifications`:

- set `email_enabled:false`; email deliveries should stop globally;
- set `line_enabled:false`; LINE sends should stop;
- change `deadline_days` and verify new cadence.

Restore intended production settings.

### T31 — SMTP-only email delivery

1. Configure `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SENDER_EMAIL`.
2. Run `python Agent/check_integrations.py --smtp you@example.com`.
3. Trigger a digest, deadline reminder, and urgent watched-opportunity change.

Expected: SMTP messages arrive and the delivery ledger records status. No Resend/SendGrid/Mailgun path is active in this release.

### T32 — LINE delivery

1. Link a test LINE account (T33).
2. Enable LINE alerts.
3. Trigger digest/watchlist event.

Expected: LINE message arrives and delivery ledger records channel/status.

### T33 — LINE linking security

1. Settings → generate link code.
2. Confirm code has expiry.
3. Send valid code to configured LINE bot before expiry → account links.
4. Generate another code and test after expiry → must fail.
5. Reusing a consumed code must fail.

---

# Application Studio

### T34 — Studio modes

For one real profile + verified opportunity, run each mode from `/copilot`:

```text
requirements
cover letter
cold email
statement of purpose
personal statement
research proposal
recommendation brief
interview practice
application checklist
```

Expected:

- output is specific to provided profile/opportunity;
- JSON modes render structured content;
- missing facts are flagged/placeheld rather than invented;
- usage credits increment by configured action cost.

### T35 — Resume tailoring

Open Resume Builder, choose profile/opportunity and run AI tailoring.

Expected: wording improves but employer/institution/dates/achievements are not fabricated; generation is server-side and metered.

### T36 — Generation history

With history enabled, create multiple generations.

Expected: `ai_generations` records action/provider/model/content and the user only sees own history.

### T37 — No invented-achievement behavior

Use a profile deliberately missing publications/awards. Ask for SOP/recommendation/resume.

Expected: no fabricated publication/award appears; missing evidence is identified.

---

# Plans and Stripe

### T38 — Plan definitions

Admin/SQL inspect `plans`.

Expected active plan IDs include Free, Pro, Counselor and Sponsor definitions with credits/watchlist/features appropriate to your configured offering.

### T39 — Stripe Checkout

Use Stripe test mode.

1. Configure test price IDs.
2. User opens `/pricing` and selects Pro/other plan.
3. Confirm hosted Stripe Checkout opens.
4. Complete with a Stripe test card.
5. Verify return URL is your server-configured `SITE_URL`, not a client-supplied arbitrary domain.

### T40 — Billing portal

After successful test subscription, open Manage Billing.

Expected: Stripe customer portal opens for that user/customer only.

### T41 — Signed webhook

1. Send a valid Stripe test webhook → subscription row updates.
2. Send a request with invalid/missing Stripe signature.

Expected: invalid signature is rejected even though Supabase JWT verification is disabled for this webhook endpoint.

Test cancellation/update events and confirm `subscriptions.status`, period dates and cancellation state update.

---

# Sponsor platform

### T42 — Sponsor plan + account

1. Normal/free user tries to create sponsor account → blocked.
2. Sponsor-plan user creates account.
3. Attempt direct DB insert as free user → RLS blocks it.

### T43 — Sponsor verification

Staff/admin opens `/quality`, verifies sponsor.

Expected: sponsor status changes and audit record is created.

### T44 — Campaign creation

Verified sponsor creates campaign with targeting, description and destination.

Expected: campaign enters review/pending state, not silently active.

### T45 — Campaign moderation

Staff/admin reviews campaign destination/content and activates/rejects it.

Expected: status changes via server function and is audited.

### T46 — Personalized sponsored matching

Student with different profiles opens `/sponsored`.

Expected: campaigns are scored/sorted using country/level/field profile alignment and show fit reasons rather than displaying all campaigns identically.

### T47 — Per-campaign consent / selected fields only

1. Before consent, inspect sponsor workspace: student profile should not be available.
2. Student clicks share/interest and reviews selected fields.
3. Confirm.
4. Sponsor workspace now sees only `lead_data` fields explicitly shared, not entire `user_profiles` record.

Inspect `lead_consents.shared_fields` and `campaign_leads.lead_data`.

### T48 — Global sponsor lead switch

Admin sets `monetization.sponsor_leads_enabled=false`.

Student attempts consent.

Expected: `lead-consent` rejects server-side. Restore true.

### T49 — Sponsor Lead Quality Agent

Create several consented leads with varied profile fit. Run agent.

Expected: match/quality scores update; agent cannot create consent where none exists.

### T50 — Sponsor lead pipeline

Sponsor opens workspace and moves a consented lead through allowed statuses.

Expected: sponsor can operate its own campaign leads only; another sponsor cannot query/update them.

---

# Counselor / agency platform

### T51 — Counselor plan gate

1. Free user tries to create counselor workspace → UI blocks.
2. Attempt browser/direct insert → DB RLS blocks.
3. Counselor-plan user succeeds.

### T52 — Invite student

Counselor invites `student-a@example.com`.

Expected: invitation row contains email/status but does not automatically grant counselor access to the student's profile.

### T53 — Student acceptance

Student A opens `/counselor-invites`, sees the workspace and accepts.

Expected: `student_user_id`, `status=accepted`, and `consented_at` are set.

Student B must not be able to accept Student A's email invitation.

### T54 — AI readiness consent gate

Before T53, counselor runs readiness review → denied.
After T53 → review can load that student's profile if counselor is owner/member of the same organization.

A counselor from another organization must be denied.

### T55 — Counselor tasks

Create/assign/update a student task with due date/priority/status.

Expected: organization members see/manage only their organization tasks.

### T56 — Counselor Deadline Agent

Seed accepted students/applications with near deadlines and run agent.

Expected: useful deadline/missing-work tasks are created without duplicating the same task every run.

---

# Program referrals

### T57 — Disclosed referral consent

Use a verified program with `referral_enabled=true` and a partner disclosure.

1. Student opens `/programs`.
2. Click Request disclosed referral.
3. Read disclosure and confirm.

Expected: request goes through `referral-consent` (not direct browser table insert); row contains consent text/profile/referral data.

### T58 — Server validates referral program

Try invoking `referral-consent` for:

- unverified program;
- verified but `referral_enabled=false` program.

Expected: both are rejected server-side.

### T59 — Global referral switch

Admin sets `monetization.referrals_enabled=false`.

Expected: new referral requests are rejected by function regardless of UI. Restore true.

### T60 — Staff referral handling

Staff/admin `/quality` moves a requested referral through allowed statuses.

Expected: status change is audited.

---

# Analytics and automation agents

### T61 — Analytics dashboard

Create applications across pipeline states, match scores, watchlists and AI usage.

Open `/analytics`.

Verify:

- application funnel counts;
- interview rate;
- offer rate;
- average match;
- watchlist count;
- AI usage;
- deadline-risk indicators.

### T62 — Growth Agent

Run production agent against staging data.

Expected: growth metrics/agent telemetry is written without mutating private data incorrectly.

### T63 — Cost/Abuse Agent

Create unusual AI usage patterns in staging and run cost/abuse monitor.

Expected: agent events/flags identify anomalous usage; it does not alter billing or user permissions autonomously.

### T64 — Verified-only Content Agent

Ensure one verified and one unverified opportunity exist.

Run content agent.

Expected: verified opportunity can produce/update content; unverified item is not used for automated trusted content.

### T65 — Social publishing

First run with:

```dotenv
FACEBOOK_PUBLISH_ENABLED=false
```

Expected: no post.

Then in a test Facebook Page configure credentials + enable. Run with a verified item.

Expected: a post ID is returned and `social_publications` records it; repeat run must not re-post same item/channel.

### T66 — Old mass blog generator is retired

Check release:

```bash
find Blog_Agent Agent -maxdepth 1 -type f | sort
```

Expected: no old `blog_agent.py`, backup/legacy agent or cinematic test agents. `daily_scraper.yml` is sitemap-only.

### T67 — Daily multi-agent GitHub workflow

GitHub → Actions → “Daily ScholarPortal Multi-Agent Pipeline” → Run workflow.

Expected: installs `Agent/requirements.txt`, runs `python agent.py`, and writes agent run/events.

### T68 — Sitemap workflow

Run “ScholarPortal Sitemap Refresh”.

Expected: sitemap generated from DB content; workflow commits only when `public/sitemap.xml` changed.

---

# Privacy / account / security

### T69 — Account export

Student A → Account & Data → export.

Expected: export contains Student A's permitted profile/application/watchlist/AI/consent/referral/workspace data and does not contain Student B data.

### T70 — Account deletion

Use a disposable account.

1. Create profile, settings, counselor invite/link and application.
2. Delete account.

Expected: auth user deleted and cascading/explicit cleanup removes private account-linked records as designed. Do not perform this test on a needed account.

### T71 — Terms

Open `/terms` logged out and logged in.

Expected: page explains opportunity verification limits, AI responsibility, billing, sponsor/referral disclosure and account/data controls.

### T72 — HTML sanitization

Insert controlled malicious HTML into a staging blog article, e.g. script tag, inline JS handler and unsafe URL.

Open article.

Expected: executable content does not run; only allowed markup remains.

### T73 — Two-user RLS isolation (critical)

Using Student A's browser/session, attempt to select/update/delete known Student B IDs through Supabase client/REST for:

```text
user_profiles
user_settings
user_applications
user_watchlists
user_match_scores
ai_generations
notification_deliveries
lead_consents
program_referrals
```

Expected: zero rows / permission failure. Repeat inverse direction.

Also test sponsor/counselor cross-organization isolation.

### T74 — Application query scoping

Open Student A Applications and inspect network query.

Expected: frontend query is scoped to own user where applicable and RLS independently protects the table.

### T75 — Frontend secret scan

```bash
rg -n "VITE_(CGU|GROQ|OPENAI|GEMINI)_API_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY|sk_live_|BEGIN.*PRIVATE KEY" src public .env.example
```

Expected: no real private credentials.

### T76 — Package secret/key exclusion

```bash
find . -type f \( -name '.env' -o -name '*.pem' -o -name '*.key' -o -name 'id_rsa' \) -print
find . -type d \( -name '.git' -o -name node_modules \) -print
```

Expected: no real `.env`, private keys, `.git`, or `node_modules` in the delivered release.

---

# Staff / admin control planes

### T77 — Staff Trust & Quality access

- normal user → `/quality`: denied/redirected;
- staff → allowed;
- admin → allowed;
- staff → `/admin`: denied.

### T78 — Admin access

- admin → `/admin`: allowed;
- staff/normal user → denied;
- direct `admin-api` invocation by non-admin → 403.

### T79 — User administration

Admin:

- create disposable user;
- promote user→staff→admin;
- suspend/unsuspend;
- delete disposable user.

Expected: auth state changes and each mutation gets audit record.

### T80 — Self-lockout protections

As current admin, attempt:

- demote own account;
- suspend own account;
- delete own account.

Expected: all blocked server-side.

### T81 — Admin resource management

Open each admin group and verify list/edit/create/delete where intentionally permitted:

```text
Opportunities / Programs / Student Profiles / User Settings
Plans / Subscriptions / Sponsors / Campaigns / Leads / Consents / Referrals
Organizations / Members / Counselor Students / Tasks
Applications / Watchlists / Match Scores / Notifications
AI Usage / AI Generations / Agent Runs / Agent Events
Review Queue / Sources / Verifications / Versions / Analytics
Blog Posts / Opportunity Articles / Social Publications
```

Expected: whitelisted fields only; privileged mutations happen through `admin-api` and are audited.

### T82 — Platform settings

Admin edits:

```text
trust
notifications
monetization
ai
```

Verify actual enforced behavior with T04/T05/T17/T30/T48/T59.

`branding`/`maintenance` are centralized configuration records ready for operational use; do not assume a maintenance splash is active unless you explicitly wire one into deployment/routing.

### T83 — Audit log

Perform several admin/staff mutations.

Expected: `admin_audit_logs` contains actor, action, resource, resource ID, before/after when available, timestamp. Admin UI does not allow audit-log edits/deletes.

### T84 — Manual agent/sitemap workflow buttons

Configure Edge Function secrets:

```text
GITHUB_ACTIONS_TOKEN
GITHUB_REPOSITORY
```

Admin → operations → trigger agent and sitemap workflows.

Expected: GitHub returns workflow dispatch success and audit log records the trigger.

Without secrets, UI should show a clear configuration error rather than silently succeed.

### T85 — Admin bootstrap

Run:

```bash
python scripts/promote_admin.py admin@example.com admin
```

Re-login. Expected: `/admin` becomes available. Test `staff` similarly for `/quality`.

---

# Responsive UI and color QA

### T86 — Navigation widths

Chrome/Firefox responsive mode:

```text
320 × 568
375 × 667
390 × 844
768 × 1024
1024 × 768
1440 × 900
```

Expected:

- phones: desktop center navigation hidden; mobile drawer/hamburger usable;
- no logo/account/nav collision;
- authenticated sidebar becomes off-canvas on small screens;
- desktop sidebar appears at large widths.

### T87 — Admin desktop/mobile presentation

At >=768px: resource data should use tables with contained horizontal scroll if needed.
At phone widths: same resources should render cards; no table is squeezed unreadably into viewport.

### T88 — Forms and actions

Test Profile, Settings, Pricing, Sponsor, Counselor, Admin editor at phone width.

Expected: multi-column forms stack; primary actions remain visible/tappable; labels do not overlap.

### T89 — Wide content containment

Test Applications Kanban, admin data sets and long JSON/content fields.

Expected: component-level horizontal scrolling where necessary; page itself should not drift sideways.

### T90 — Counselor invitations mobile

At 320px, long email address + Accept button.

Expected: card stacks, email wraps/breaks, button stays reachable.

### T91 — Semantic colors

Check light and dark modes.

Expected consistent meaning:

```text
Indigo = primary/action
Cyan = AI/intelligence accent
Emerald = verified/success
Amber = warning/review
Rose = destructive/error
Slate = neutral surfaces/text
```

### T92 — Keyboard focus

Tab through navbar, buttons, forms and admin controls.

Expected: visible focus ring; controls remain usable without mouse.

### T93 — Contrast

Representative palette targets in `docs/UI_QA.md` meet WCAG AA for normal text. Still use browser accessibility tooling (Lighthouse/Axe) against rendered pages because final contrast also depends on opacity, font size, state and component composition.

---

# Final staging acceptance

Do not mark production release complete until all of these pass:

```text
[ ] npm ci
[ ] npm run lint
[ ] npm run build
[ ] python scripts/verify_release.py
[ ] migrations apply cleanly to staging
[ ] schema_smoke.sql reviewed
[ ] two-user RLS isolation
[ ] AI failover test
[ ] search/fetch verification test
[ ] notification dedupe + frequency test
[ ] Stripe test checkout/webhook/portal
[ ] sponsor consent isolation
[ ] counselor consent isolation
[ ] referral disclosure/server validation
[ ] admin/staff permissions + audit
[ ] account export/delete
[ ] mobile 320/375 + tablet + desktop QA
[ ] light/dark color/contrast/accessibility check
[ ] agent workflow with social publishing disabled
[ ] Trust & Quality queue reviewed
```


# 2026-09-13 release additions

### T94 — 4-digit OTP-only login
1. Deploy migration `202609130005_auth_community_notifications.sql` and both OTP functions.
2. Use an existing account email.
3. Auth → 4-digit OTP → request code.
4. Confirm SMTP delivery and enter the code.
5. Confirm a Supabase session is created.
6. Repeat with an email that has no account: response must stay neutral and no new auth user may be created.
7. Verify expiry (10 minutes), five-attempt lockout, and request throttling.

### T95 — 4-digit password reset
Request reset code, verify it, set a new password, sign out, then sign in using the new password. Confirm an unknown email cannot create an account.

### T96 — Expanded AI provider cascade
With staging keys, force earlier providers to fail/disable one at a time and verify fallback order: CGU → Groq → OpenRouter → NVIDIA NIM → Mistral → Google AI Studio → Cerebras → OpenAI. Confirm `ai_generations` records the responding provider/model.

### T97 — Granular notification preferences
For each topic toggle (matches, watchlist changes, deadlines, application updates, sponsor matches, counselor tasks, referrals, product/news), disable it and trigger its event. Confirm no channel delivers it. Re-enable and test in-app, SMTP, and LINE independently.

### T98 — Anonymous signup-benefits banner
Open the public site logged out on 320px, 375px, tablet and desktop widths. Confirm the animated benefits banner appears every full page refresh, can be closed with X, and auto-dismisses at 10 seconds without blocking browsing.

### T99 — Likes, comments and threaded replies
Logged out: read counts/comments but writes are blocked. Logged in: like/unlike a blog and opportunity, comment, reply to a comment, reply to a reply, delete own comment. Verify RLS prevents editing/deleting another user's records.

### T100 — New safety/freshness/moderation/coach agents
Run `python Agent/agent.py` in staging. Verify opportunity safety/freshness fields update, obvious spam comments are hidden, and application deadline coaching notifications respect user preferences.

### T101 — SMTP + LINE smoke test
`python Agent/check_integrations.py --smtp you@example.com --line YOUR_LINE_USER_ID`
Expected: both report OK and real test messages arrive.
