> **17 September 2026 upgrade:** Start with [deployment steps](docs/DEPLOY_UPGRADE.md) and the [33-item change list, agent inventory and validation report](docs/UPGRADE.md). These supersede older release-status notes below.

# ScholarPortal — Complete AI Scholarship & Application Platform

ScholarPortal is a responsive public scholarship/opportunity discovery site plus authenticated student, counselor, sponsor and administrator workspaces. This release adds a server-side multi-provider AI router, verified research agents, 4-digit SMTP OTP authentication, threaded community engagement, granular notification controls, Stripe billing, sponsor/counselor monetization flows, Trust & Quality review, and a full admin control plane.

## 1. What is included

### Public experience
- Browse verified opportunities, degree programs, blog posts and opportunity deep-dives without signing in.
- Modern light/dark responsive UI for phone, tablet and desktop.
- Animated 10-second guest-benefits banner on every page refresh while logged out. The visitor can close it immediately.
- Public reading of likes/comments; sign-in required to like, comment or reply.

### Authentication
- Email + password sign-up/login through Supabase Auth.
- OTP-only login using a **custom secure 4-digit email OTP**.
- Password reset using the same 4-digit OTP, followed by a valid Supabase recovery session.
- OTP codes are generated server-side, hashed before storage, expire after 10 minutes, are invalidated when reissued, have request throttling, and lock after repeated failures.
- OTP delivery uses **SMTP only**.

### Student product
- Structured student profile and eligibility data.
- Explainable scholarship/opportunity matching.
- Watchlists, source-change monitoring and deadline reminders.
- Application Kanban and analytics.
- AI Application Studio: requirements, checklist, cover letter, cold email, SOP, personal statement, research proposal, recommender brief, interview practice, resume tailoring, profile-gap review, competitiveness review, opportunity safety review and application strategy.
- Degree-program matching and referral consent.
- In-app notification center + SMTP + LINE.
- Fine-grained notification topic/channel controls.

### B2B / monetization
- Free / Pro / Counselor / Sponsor plan model.
- Stripe Checkout, Billing Portal and signed webhook handling.
- Sponsored campaigns with explicit student consent and field-level lead sharing.
- Counselor/agency workspace with student invitation/acceptance and task tracking.
- Program referral workflow with explicit compensation disclosure and consent.

### Admin / trust
- Admin panel for users/roles, opportunities/programs, profiles/settings, subscriptions/plans, sponsors/campaigns/leads, counselor data, applications/watchlists/matches, AI usage, notifications, agents, comments/likes, content, analytics, review queue and system settings.
- Staff Trust & Quality queue for uncertain opportunities.
- Admin audit log and self-lockout protections.
- Supabase RLS for private user data.

## 2. Agent architecture

### Research & trust agents
1. **Opportunity Research Agent** — searches for scholarships/fellowships/internships from real web results.
2. **Program Research Agent** — discovers degree programs from real sources.
3. **Source Verification Agent** — fetches the source and extracts facts.
4. **Official Source Agent** — rejects obvious aggregators and uncertain source ownership.
5. **Duplicate/Canonicalization logic** — prevents repeated records.
6. **Change Monitor Agent** — detects source-field changes.
7. **Program Change Monitor** — monitors program pages.
8. **Trust & Quality Agent** — routes low-confidence records to staff review rather than auto-publishing.
9. **Opportunity Safety Agent** — scores suspicious links/payment language and stores safety flags.
10. **Opportunity Freshness Agent** — scores how recently verified records were checked.

### Student success agents
11. **Eligibility Agent** — deterministic hard-rule checks before AI explanation.
12. **Match Agent** — scores fit/relevance and stores results.
13. **Profile Improvement Agent** — identifies missing evidence and high-impact profile improvements.
14. **Competitiveness Agent** — estimates relative readiness without promising selection.
15. **Application Strategy Agent** — creates deadline-aware application phases/actions.
16. **Application Coach Agent** — creates application deadline nudges according to notification preferences.
17. **Requirements Agent** — extracts documents/criteria/dates.
18. **Checklist Agent** — turns requirements into actionable tasks.
19. **SOP Agent** — statement of purpose drafting.
20. **Personal Statement Agent** — evidence-grounded narrative drafting.
21. **Cover Letter Agent** — opportunity-tailored cover letters.
22. **Cold Email Agent** — professor/program outreach without invented contacts.
23. **Research Proposal Agent** — proposal structure and draft abstract.
24. **Recommendation Brief Agent** — factual recommender briefing material.
25. **Resume Tailoring Agent** — wording/ordering improvements while preserving facts.
26. **Interview Practice Agent** — questions and answer frameworks.
27. **Opportunity Safety Review Agent** — on-demand scam/red-flag review in Application Studio.
28. **Degree Program Match Agent** — field/destination/GPA/budget program matching.

### Operations / revenue agents
29. **Notification Agent** — in-app/SMTP/LINE dispatch with deduplication.
30. **Digest Agent** — daily/weekly/monthly verified-match digests.
31. **Deadline Agent** — deadline reminders to selected channels.
32. **Watchlist Agent** — urgent source-change delivery when enabled.
33. **Sponsor Match / Lead Quality Agent** — scores consented campaign leads.
34. **Counselor Deadline Agent** — identifies counselor-managed deadline risks.
35. **Growth Agent** — summarizes funnel activity.
36. **AI Cost / Abuse Agent** — watches unusually high AI usage.
37. **Verified Content Agent** — generates articles only from verified records.
38. **Social Growth Agent** — optionally publishes verified opportunity content.
39. **Community Moderation Agent** — automatically hides obvious spam/suspicious community comments; admin can review/manage community data.

## 3. Fallbacks

### AI provider route
Every configured provider participates in a server-side fallback sequence. Missing keys are skipped automatically:

1. CGU
2. Groq
3. OpenRouter
4. NVIDIA NIM
5. Mistral AI
6. Google AI Studio / Gemini
7. Cerebras
8. OpenAI

The selected provider/model is logged with AI usage/generation records. API keys never enter the React bundle.

### Research search route
1. Serper
2. Tavily
3. Bing Web Search
4. DuckDuckGo HTML fallback

### Source-fetch route
1. standard HTTP request
2. browser-like request headers
3. cache-busting request
4. Jina Reader fallback

### Email
SMTP only, by design in this release.

## 4. Requirements

Recommended:
- Node.js 20+
- npm 10+
- Python 3.11+
- Supabase CLI
- A Supabase project
- SMTP account
- At least one AI provider key (all listed providers can be configured)
- At least one research API key for reliable discovery; Serper + Tavily are recommended
- Stripe account if billing is enabled
- LINE Messaging API channel if LINE is enabled

## 5. Frontend environment

Copy:

```bash
cp .env.example .env
```

Only public browser values belong here:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
VITE_SITE_URL=http://localhost:5173

# optional existing upload feature
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

**Never put AI keys, Stripe secrets, SMTP credentials or `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` variable.**

## 6. Server/API secrets to add

Use `supabase/.env.example` as the source of truth for Supabase Edge Functions.

### Core
```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SITE_URL=https://your-domain.example
OTP_PEPPER=
```

Generate the OTP pepper locally, for example:

```bash
openssl rand -hex 32
```

### AI provider keys
```env
CGU_API_KEY=
CGU_API_URL=https://air.cgu.edu.tw/cgullmapi/v1/chat/completions
CGU_MODEL=gpt-4o

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free

NVIDIA_NIM_API_KEY=
NVIDIA_NIM_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_NIM_MODEL=openai/gpt-oss-20b

MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-small-latest

GEMINI_API_KEY=
GOOGLE_AI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

CEREBRAS_API_KEY=
CEREBRAS_MODEL=gpt-oss-120b

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

`GEMINI_API_KEY` and `GOOGLE_AI_API_KEY` are aliases; one Google AI Studio key is enough. If both exist, `GEMINI_API_KEY` is preferred.

### SMTP only
```env
SMTP_SERVER=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SENDER_EMAIL=noreply@your-domain.example
```

Port 465 uses implicit SSL. Other ports use STARTTLS.

### Research APIs (Python agents / GitHub Actions)
```env
SERPER_API_KEY=
TAVILY_API_KEY=
BING_SEARCH_API_KEY=
```

### Stripe
```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_PRICE_COUNSELOR=
STRIPE_PRICE_SPONSOR=
```

The checkout function also accepts `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_COUNSELOR_MONTHLY`, and `STRIPE_PRICE_SPONSOR_MONTHLY` as aliases.

### LINE
```env
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
```

### Optional social publishing
```env
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_GRAPH_API_VERSION=v25.0
FACEBOOK_PUBLISH_ENABLED=false
```

### Optional admin GitHub workflow trigger
```env
GITHUB_ACTIONS_TOKEN=
GITHUB_REPOSITORY=owner/repository
```

## 7. Install frontend

```bash
npm ci
npm run dev
```

Production acceptance:

```bash
npm run verify
npm run lint
npm run build
```

## 8. Install Python agents

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r Agent/requirements.txt
cp Agent/.env.example Agent/.env
```

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r Agent/requirements.txt
copy Agent\.env.example Agent\.env
```

Run the full agent pipeline:

```bash
cd Agent
python agent.py
```

## 9. Database migration — REQUIRED

Do not manually paste individual table snippets into production. Use the ordered migrations.

Current migration order:

```text
202609110000_base_schema_compat.sql
202609110001_commercial_platform.sql
202609110002_quality_and_program_intelligence.sql
202609110003_admin_control_plane.sql
202609110004_operational_hardening.sql
202609130005_auth_community_notifications.sql
```

### Recommended staging process

1. Back up the live database.
2. Create/link a staging Supabase project.
3. Preview migrations.
4. Apply them to staging.
5. Deploy Edge Functions.
6. Execute the smoke test.
7. Run the module tests below.
8. Only then repeat for production.

Commands:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push --dry-run
supabase db push
```

For a local Supabase stack:

```bash
supabase start
supabase db reset
```

Then run:

```bash
psql YOUR_DATABASE_URL -f supabase/tests/schema_smoke.sql
```

or paste `supabase/tests/schema_smoke.sql` into the Supabase SQL editor.

## 10. Deploy Supabase Edge Functions

Required functions:

```bash
supabase functions deploy ai-gateway
supabase functions deploy otp-request
supabase functions deploy otp-verify
supabase functions deploy billing-checkout
supabase functions deploy billing-portal
supabase functions deploy stripe-webhook
supabase functions deploy lead-consent
supabase functions deploy referral-consent
supabase functions deploy account-export
supabase functions deploy account-delete
supabase functions deploy quality-admin
supabase functions deploy admin-api
```

`otp-request`, `otp-verify` and `stripe-webhook` have `verify_jwt = false` in `supabase/config.toml` because they must accept pre-login/webhook requests. They still perform their own validation and do not expose service credentials.

### Set function secrets

Recommended:

```bash
cp supabase/.env.example supabase/.env.local
# Fill the values, then:
supabase secrets set --env-file supabase/.env.local
```

Do not commit `supabase/.env.local`.

## 11. Stripe setup

1. Create three recurring Stripe Prices: Pro, Counselor, Sponsor.
2. Put their `price_...` IDs in the three `STRIPE_PRICE_*` secrets.
3. Deploy `billing-checkout`, `billing-portal`, `stripe-webhook`.
4. In Stripe Dashboard add webhook endpoint:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
```

5. Subscribe to at least:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
7. Test in Stripe test mode before live mode.

## 12. 4-digit OTP setup and test

OTP email is sent directly through your SMTP server, not Supabase's built-in 6-digit OTP.

After migration + function deployment + SMTP secrets:

1. Create a normal user with email/password.
2. Log out.
3. Open `/auth`.
4. Choose **4-digit OTP**.
5. Enter the account email and request the code.
6. Confirm the SMTP message arrives.
7. Enter the four digits.
8. Confirm a valid Supabase session is created and the user reaches the dashboard.
9. Log out and test `/reset-password` the same way.
10. After verification, set a new password and confirm it works through normal password login.

Security tests:
- wrong code increments attempts;
- after five wrong attempts the challenge blocks;
- expired code is rejected;
- requesting a new code invalidates earlier unused codes;
- requesting repeatedly triggers rate limiting;
- an unknown email gets a neutral response to reduce account enumeration.

## 13. SMTP + LINE integration smoke test

From `Agent/` with `.env` configured:

```bash
python check_integrations.py --smtp YOUR_TEST_EMAIL
```

Expected: `SMTP: OK` and a test email arrives.

After linking a LINE user ID:

```bash
python check_integrations.py --line YOUR_LINE_USER_ID
```

You may test both at once:

```bash
python check_integrations.py --smtp YOUR_TEST_EMAIL --line YOUR_LINE_USER_ID
```

### LINE account linking

1. Deploy/run `Agent/webhook.py` on a public HTTPS host.
2. Configure the LINE Messaging API webhook to:

```text
https://YOUR_WEBHOOK_HOST/callback
```

3. In ScholarPortal Settings enable LINE.
4. Send the displayed 6-digit LINE-linking code to the bot. This is intentionally separate from the 4-digit login OTP.
5. The webhook validates the code expiry, links `line_user_id`, and clears the code.
6. Run the LINE smoke test above.

## 14. Notification preference testing

Go to `/settings` and independently toggle:
- in-app notifications;
- SMTP email;
- LINE;
- new profile matches;
- watchlist changes;
- deadline reminders;
- application updates;
- sponsored matches;
- counselor tasks;
- referral updates;
- product/news;
- urgent change alerts;
- digest frequency (daily/weekly/monthly);
- matching countries/levels/fields.

Then run:

```bash
cd Agent
python agent.py
```

Verify `notification_deliveries` contains only enabled channels/topics and that duplicate `delivery_key` values are not created for the same user/channel.

## 15. Community like/comment testing

Apply migrations, then:

1. Open a `/blog/:slug` page logged out: comments/likes are readable, writes ask for sign-in.
2. Sign in and like the page.
3. Add a comment.
4. Reply to another comment.
5. Sign in as a second user and verify normal thread reading/replying.
6. Confirm User B cannot edit/delete User A's comment through the API.
7. As admin, open the admin panel and manage Comments/Likes.
8. Run the agent pipeline and verify obvious spam patterns can be hidden by Community Moderation Agent.

## 16. AI provider fallback test

Test each configured provider by temporarily setting all other AI keys blank in a staging environment and invoking an Application Studio action.

Then configure all keys and intentionally break the first provider key. Verify the request falls through to the next configured provider and `ai_usage` / `ai_generations` records the provider/model that succeeded.

Current provider order:

```text
CGU -> Groq -> OpenRouter -> NVIDIA NIM -> Mistral -> Google AI Studio -> Cerebras -> OpenAI
```

## 17. Research fallback test

Test with:
1. Serper configured;
2. Serper invalid + Tavily configured;
3. Serper/Tavily invalid + Bing configured;
4. all search keys blank to exercise DuckDuckGo HTML.

Confirm discovered candidate URLs still pass through verification before publication.

## 18. Guest banner / responsive UI test

Logged out:
- Refresh any public page: the benefits banner should animate in.
- It should list AI resume tailoring, cold email/cover letters, eligibility matching, notifications and verified intelligence.
- It closes after about 10 seconds or immediately via X.
- Refreshing the page shows it again.

Test widths:
- 320px
- 375px
- 430px
- 768px
- 1024px
- 1440px+

Check:
- no page-level horizontal overflow;
- guest banner remains readable at 320px;
- nav/actions are usable with touch;
- admin tables/cards remain usable;
- community replies indent without overflowing;
- OTP inputs fit 320px screens;
- modals/Kanban own their internal scrolling.

## 19. Modern UI system

Primary visual system:
- Indigo — main product/action
- Cyan — AI/intelligence accent
- Slate — neutral surfaces/text
- Emerald — verified/success
- Amber — warning/review
- Rose — error/destructive

Modern UI additions include glass panels, restrained gradients/radial canvas lighting, animated guest banner, Framer Motion transitions, responsive cards/forms and reduced-motion support via `prefers-reduced-motion`.

## 20. Admin bootstrap

After creating your first normal account, promote it using the server-side utility:

```bash
python scripts/promote_admin.py --email admin@example.com
```

The script requires server-side Supabase credentials. Then log out/in so the new JWT includes admin metadata.

## 21. GitHub Actions secrets

For the daily multi-agent workflow, add repository Actions secrets for every provider you want used:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SERPER_API_KEY
TAVILY_API_KEY
BING_SEARCH_API_KEY
CGU_API_KEY
GROQ_API_KEY
OPENROUTER_API_KEY
NVIDIA_NIM_API_KEY
MISTRAL_API_KEY
GEMINI_API_KEY or GOOGLE_AI_API_KEY
CEREBRAS_API_KEY
OPENAI_API_KEY
SMTP_SERVER
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
SENDER_EMAIL
LINE_CHANNEL_ACCESS_TOKEN
FACEBOOK_PAGE_ID (optional)
FACEBOOK_PAGE_ACCESS_TOKEN (optional)
```

## 22. Security notes

- Rotate the SSH private key and any secrets that were present in the original project archive if that archive was shared.
- Never commit `.env`, `Agent/.env`, `supabase/.env.local`, service-role credentials or private keys.
- Keep RLS enabled; do not make private user tables public to solve permission bugs.
- Treat AI output as assistance, not authoritative eligibility/legal/admission advice.
- Keep official source URLs visible and tell users the official provider remains authoritative.
- Do not sell/share student data without the consent paths already implemented.

## 23. Final release checklist

Before production:

```bash
npm ci
npm run verify
npm run lint
npm run build
python -m py_compile Agent/*.py scripts/*.py
```

Then:
- apply all migrations in staging;
- deploy all Edge Functions;
- set all server secrets;
- test 4-digit OTP login/reset;
- run SMTP and LINE smoke checks;
- run Stripe in test mode;
- run one full agent job;
- verify low-confidence research enters the review queue;
- test two-user RLS isolation;
- test guest/mobile/desktop flows;
- only then deploy production.
Testing new update
