# ScholarPortal Admin & Staff Control Plane

## Access model

ScholarPortal has two privileged roles stored in Supabase Auth **`app_metadata.role`**:

- `admin` — full `/admin` control plane plus `/quality`;
- `staff` — `/quality` only.

Normal users cannot access either privileged server API. UI route protection is only the first layer: `admin-api` and `quality-admin` independently verify the authenticated JWT and role server-side.

Cross-user operations use the Supabase service role **inside Edge Functions only**. The service-role key is never placed in React/Vite.

## First admin / staff

From a trusted machine:

```bash
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
python scripts/promote_admin.py admin@example.com admin
python scripts/promote_admin.py reviewer@example.com staff
```

Sign out and back in after a role change so the JWT refreshes.

## `/admin` scope

The admin control plane covers:

### Users

- list Auth users;
- create users with temporary passwords;
- assign `user`, `staff`, `admin` roles;
- suspend/unsuspend;
- delete disposable/other users.

Safety controls prevent the logged-in admin from accidentally:

- demoting themself;
- suspending themself;
- deleting themself.

### Core product data

- opportunities;
- degree programs;
- student profiles;
- user settings;
- opportunity source provenance;
- verification records;
- opportunity versions.

### Revenue

- plans;
- subscriptions;
- sponsor accounts;
- campaigns;
- consented leads;
- lead consents;
- disclosed program referrals.

### Counselor

- organizations;
- organization members;
- counselor/student relationships;
- tasks.

### Student operational data

- applications;
- watchlists;
- match scores;
- notification deliveries.

### AI and operations

- AI usage;
- AI generations;
- agent runs;
- agent events;
- review queue;
- analytics.

### Content/system

- blog posts;
- opportunity articles;
- social publication records;
- platform settings;
- immutable admin audit log.

The admin API exposes only whitelisted fields/actions for each resource instead of accepting arbitrary table names or arbitrary SQL.

## Platform settings that are actively enforced

### `ai`

```json
{
  "enabled": true,
  "abuse_guard_enabled": true,
  "save_generation_history": true
}
```

`enabled` and `save_generation_history` are enforced by `ai-gateway`. Quotas are always enforced independently.

### `trust`

```json
{
  "auto_publish_min_confidence": 88,
  "program_auto_publish_min_confidence": 80,
  "require_official_source": true
}
```

The agent uses the confidence thresholds before auto-publication. Official-source checks remain conservative.

### `notifications`

```json
{
  "email_enabled": true,
  "line_enabled": true,
  "deadline_days": [30, 14, 7, 3, 1]
}
```

The Notification Agent reads these values.

### `monetization`

```json
{
  "sponsor_leads_enabled": true,
  "referrals_enabled": true
}
```

`lead-consent` and `referral-consent` enforce these switches server-side.

`branding` and `maintenance` are centralized configuration records for operational use. This release does not claim that `maintenance.enabled` automatically replaces every frontend route with a maintenance page.

## Trust & Quality Console (`/quality`)

Admin/staff can:

- review borderline opportunity candidates;
- approve/reject candidates;
- verify sponsor accounts;
- activate/reject campaigns;
- process referral status;
- inspect recent agent runs/events.

These actions are server-side and audited.

## Admin audit trail

Privileged actions are inserted into `admin_audit_logs`, including:

- admin CRUD;
- role changes;
- user suspension/deletion;
- quality approvals/rejections;
- sponsor verification;
- campaign status;
- referral status;
- manual workflow dispatch.

The admin UI intentionally does not allow editing/deleting audit history.

## Manual automation controls

The Admin overview can dispatch:

- `.github/workflows/opp_agent.yml` — main multi-agent pipeline;
- `.github/workflows/daily_scraper.yml` — DB-backed sitemap refresh.

Configure Edge Function secrets:

```text
GITHUB_ACTIONS_TOKEN
GITHUB_REPOSITORY=owner/repository
```

Use a narrowly scoped GitHub token. If these secrets are absent, the control plane reports that the operation is not configured rather than pretending it ran.

## Deployment

1. Apply all migrations in `docs/DATABASE_SETUP.md`.
2. Deploy `admin-api` and `quality-admin` (and the other release functions).
3. Promote the first admin.
4. Re-login.
5. Run tests T77–T85 from `docs/TESTING.md`.
