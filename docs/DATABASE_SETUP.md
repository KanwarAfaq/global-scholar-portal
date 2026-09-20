# Database, RLS and Edge Function Setup

This guide is written for both a fresh Supabase project and an existing ScholarPortal database.

## 0. Never start with production

For an existing live database:

1. Create a backup/snapshot using your normal Supabase backup process.
2. Apply this release to a staging project first.
3. Run the preflight queries below before `supabase db push`.
4. Never use `supabase db reset --linked` against production; it is destructive.

## 1. Install/link the Supabase CLI

The repository already contains `supabase/config.toml`, so you do not need to run `supabase init` for this package.

```bash
supabase login
supabase projects list
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
```

If your CLI is installed as an npm project dependency, prefix commands with `npx`, e.g. `npx supabase db push`.

## 2. Preflight an existing database

Run these in Supabase SQL Editor before migrations. Empty result sets are ideal.

### Duplicate user settings

```sql
select user_id, count(*)
from public.user_settings
group by user_id
having count(*) > 1;
```

If duplicates exist, decide which settings row is authoritative and merge/delete extras before applying the unique index.

### Duplicate applications for one opportunity

```sql
select user_id, opportunity_id, count(*)
from public.user_applications
group by user_id, opportunity_id
having count(*) > 1;
```

Merge checklist/notes/status as appropriate, then keep one row per `(user_id, opportunity_id)`.

### Duplicate active LINE verification codes

```sql
select line_verification_code, count(*)
from public.user_settings
where line_verification_code is not null
group by line_verification_code
having count(*) > 1;
```

Clear duplicate/old verification codes before migration `202609110004`.

### Duplicate URLs already present in new commercial entities

If you previously created custom tables with these names, also check:

```sql
select official_url, count(*) from public.programs group by official_url having count(*) > 1;
select user_id, program_id, count(*) from public.program_referrals group by user_id, program_id having count(*) > 1;
select user_id, campaign_id, count(*) from public.lead_consents group by user_id, campaign_id having count(*) > 1;
select campaign_id, user_id, count(*) from public.campaign_leads group by campaign_id, user_id having count(*) > 1;
```

Skip a query if the table does not yet exist.

## 3. Migration order

The CLI applies these in timestamp order:

1. `202609110000_base_schema_compat.sql`
   - creates/extends the legacy opportunity/profile/settings/applications/blog schema without requiring manual Dashboard edits;
   - preserves existing tables through `IF NOT EXISTS` / additive `ALTER TABLE` operations.
2. `202609110001_commercial_platform.sql`
   - verification/provenance/version tables;
   - plans/subscriptions, AI usage/history;
   - match scores/watchlists/notification ledger;
   - organizations/counselor tasks;
   - sponsors/campaigns/consent/leads;
   - degree programs/referrals;
   - analytics/agent telemetry/content publication;
   - core RLS and entitlement helpers.
3. `202609110002_quality_and_program_intelligence.sql`
   - human opportunity review queue;
   - degree-program verification metadata;
   - referral profile/data fields.
4. `202609110003_admin_control_plane.sql`
   - platform settings;
   - immutable admin audit log;
   - default AI/trust/notification/monetization settings.
5. `202609110004_operational_hardening.sql`
   - notification read state;
   - LINE verification expiry/uniqueness;
   - deduplication and performance indexes.

Preview and apply:

```bash
supabase db push --dry-run
supabase db push
supabase migration list
```

## 4. Fresh local Supabase test

A Docker-compatible runtime is required.

```bash
supabase start
supabase db reset
```

`db reset` recreates the local DB and replays every migration. This is one of the best ways to detect migration-order mistakes before remote deployment.

When finished:

```bash
supabase stop
```

## 5. Schema smoke checks

Run `supabase/tests/schema_smoke.sql` in SQL Editor after migration, or with your preferred Postgres client.

Important manual checks:

```sql
select key, value from public.platform_settings order by key;
select id, name, monthly_ai_credits, max_watchlists from public.plans order by id;
```

Expected platform setting keys include:

```text
ai
branding
maintenance
monetization
notifications
trust
```

## 6. Verify RLS is enabled

This query should report RLS enabled for private/user/commercial tables:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'user_profiles','user_settings','user_applications','user_watchlists','user_match_scores',
    'notification_deliveries','ai_generations','ai_usage','subscriptions',
    'organizations','organization_members','counselor_students','tasks',
    'sponsor_accounts','sponsor_campaigns','lead_consents','campaign_leads','program_referrals'
  )
order by tablename;
```

RLS being enabled is not enough by itself. Perform the two-user isolation tests in `docs/TESTING.md`.

## 7. Deploy Edge Functions

```bash
supabase functions deploy ai-gateway
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

Or, with a recent CLI, deploying functions without a name deploys all functions in the project. Explicit names are shown above so you can see exactly what this release requires.

## 8. Function secrets

Create `supabase/.env.production` from `supabase/.env.example` and **do not commit it**.

Set custom remote secrets:

```bash
supabase secrets set --env-file supabase/.env.production
supabase secrets list
```

The Supabase Edge runtime supplies project credentials such as its URL/service role to deployed functions. Do not expose the service role to React/Vite.

AI provider cascade:

```text
CGU → Groq → OpenRouter → NVIDIA NIM → Mistral → Google AI Studio → Cerebras → OpenAI
```

Billing secrets:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY
STRIPE_PRICE_COUNSELOR_MONTHLY
STRIPE_PRICE_SPONSOR_MONTHLY
SITE_URL
```

Optional admin workflow dispatch:

```text
GITHUB_ACTIONS_TOKEN
GITHUB_REPOSITORY
```

Use a narrowly scoped GitHub token capable of dispatching Actions for only the intended repository.

## 9. Stripe webhook

Endpoint:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

The function accepts unsigned Supabase/JWT requests **only** because Stripe cannot provide a Supabase JWT. It still rejects requests whose Stripe signature is invalid.

Configure at least:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

Do not make live payments until test-mode checkout, webhook updates and billing-portal return have all passed.

## 10. First admin/staff role

`admin-api` and `/admin` require:

```json
{"app_metadata":{"role":"admin"}}
```

`quality-admin` accepts `admin` or `staff`.

Promote a user from a trusted machine:

```bash
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
python scripts/promote_admin.py admin@example.com admin
```

For staff:

```bash
python scripts/promote_admin.py reviewer@example.com staff
```

The user must sign in again to refresh JWT claims.

## 11. Production-safe migration workflow

Recommended sequence:

```text
backup production
      ↓
restore/clone to staging
      ↓
run duplicate preflight
      ↓
supabase db push --dry-run
      ↓
apply migrations to staging
      ↓
deploy functions/secrets
      ↓
run TESTING.md regression suite
      ↓
apply the same migrations to production
      ↓
deploy functions
      ↓
smoke test auth/billing/AI/alerts/admin
```

Do not manually recreate these tables/policies through the Dashboard unless you intentionally decide to stop using migration-based deployment.

## 2026-09-13 migration and OTP/community additions

Apply this migration after `202609110004_operational_hardening.sql`:

```text
202609130005_auth_community_notifications.sql
```

It adds the custom hashed 4-digit OTP challenge store, service-role-only `auth_user_exists()` helper, granular notification preferences, community likes/threaded comments, and opportunity safety/freshness fields.

Deploy the two additional public-entry Edge Functions:

```bash
supabase functions deploy otp-request --no-verify-jwt
supabase functions deploy otp-verify --no-verify-jwt
```

`supabase/config.toml` also marks these functions as `verify_jwt = false`; verification is performed by the challenge protocol itself. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `OTP_PEPPER` to Vite/browser code.

The current AI fallback order is:

```text
CGU → Groq → OpenRouter → NVIDIA NIM → Mistral → Google AI Studio → Cerebras → OpenAI
```

Email is SMTP-only in this release. Configure `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SENDER_EMAIL` as server/agent secrets.

After applying migration 005, rerun `supabase/tests/schema_smoke.sql` and complete T94–T101 in `docs/TESTING.md`.
