-- ScholarPortal commercial platform + trust architecture
-- Apply with: supabase db push

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- EXISTING OPPORTUNITY TABLE: trust + structured eligibility metadata
-- ---------------------------------------------------------------------------
alter table if exists public.global_opportunities
  add column if not exists verified boolean not null default false,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verification_confidence integer not null default 0,
  add column if not exists verified_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists official_source_url text,
  add column if not exists requirements jsonb not null default '{}'::jsonb,
  add column if not exists eligibility jsonb not null default '{}'::jsonb,
  add column if not exists application_requirements jsonb not null default '{}'::jsonb,
  add column if not exists change_hash text,
  add column if not exists sponsored boolean not null default false;

create index if not exists idx_global_opportunities_verified_deadline
  on public.global_opportunities (verified, deadline);
create index if not exists idx_global_opportunities_created_at
  on public.global_opportunities (created_at desc);

-- ---------------------------------------------------------------------------
-- Opportunity provenance / versioning
-- ---------------------------------------------------------------------------
create table if not exists public.opportunity_sources (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.global_opportunities(id) on delete cascade,
  source_url text not null,
  source_domain text,
  source_type text not null default 'official',
  is_official boolean not null default false,
  http_status integer,
  content_hash text,
  extracted_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(opportunity_id, source_url)
);

create table if not exists public.opportunity_versions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.global_opportunities(id) on delete cascade,
  content_hash text not null,
  snapshot jsonb not null,
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(opportunity_id, content_hash)
);

create table if not exists public.opportunity_verifications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.global_opportunities(id) on delete cascade,
  status text not null check (status in ('verified','needs_review','rejected','unverified')),
  confidence integer not null default 0 check (confidence between 0 and 100),
  checks jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  verifier text not null default 'verification-agent',
  notes text,
  verified_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Plans, subscriptions, usage metering
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id text primary key,
  name text not null,
  audience text not null default 'student',
  monthly_ai_credits integer not null default 0,
  max_watchlists integer not null default 0,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.plans(id,name,audience,monthly_ai_credits,max_watchlists,features)
values
  ('free','Free','student',8,3,'{"advanced_matching":false,"instant_alerts":false,"application_studio":true,"counselor_workspace":false}'::jsonb),
  ('pro','ScholarPortal Pro','student',150,50,'{"advanced_matching":true,"instant_alerts":true,"application_studio":true,"counselor_workspace":false}'::jsonb),
  ('counselor','Counselor','business',500,250,'{"advanced_matching":true,"instant_alerts":true,"application_studio":true,"counselor_workspace":true}'::jsonb),
  ('sponsor','Sponsor','business',100,100,'{"campaigns":true,"lead_analytics":true}'::jsonb)
on conflict (id) do update set
  name=excluded.name, audience=excluded.audience, monthly_ai_credits=excluded.monthly_ai_credits,
  max_watchlists=excluded.max_watchlists, features=excluded.features, active=true;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active',
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  provider text,
  model text,
  credit_cost integer not null default 1,
  input_tokens integer,
  output_tokens integer,
  success boolean not null default true,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_usage_user_month on public.ai_usage(user_id, created_at desc);

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid,
  opportunity_id uuid references public.global_opportunities(id) on delete set null,
  action text not null,
  title text,
  content text,
  structured_output jsonb,
  provider text,
  model text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Matching, watchlists, reliable notification delivery
-- ---------------------------------------------------------------------------
create table if not exists public.user_match_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid,
  opportunity_id uuid not null references public.global_opportunities(id) on delete cascade,
  eligible boolean,
  score integer not null default 0 check (score between 0 and 100),
  eligibility_score integer not null default 0 check (eligibility_score between 0 and 100),
  relevance_score integer not null default 0 check (relevance_score between 0 and 100),
  competitiveness_score integer not null default 0 check (competitiveness_score between 0 and 100),
  matched_rules jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  explanation text,
  calculated_at timestamptz not null default now(),
  unique(user_id, profile_id, opportunity_id)
);

create table if not exists public.user_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.global_opportunities(id) on delete cascade,
  notify_changes boolean not null default true,
  notify_deadline boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, opportunity_id)
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid references public.global_opportunities(id) on delete cascade,
  channel text not null check (channel in ('email','line','push','in_app')),
  notification_type text not null default 'match',
  delivery_key text not null,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  clicked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id, channel, delivery_key)
);

-- ---------------------------------------------------------------------------
-- Organizations + counselor workspace
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('counselor','agency','university','foundation','company','ngo')),
  website text,
  logo_url text,
  billing_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','counselor','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.counselor_students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_user_id uuid references auth.users(id) on delete set null,
  student_email text not null,
  display_name text,
  status text not null default 'invited',
  invited_by uuid not null references auth.users(id) on delete cascade,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id, student_email)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  student_user_id uuid references auth.users(id) on delete cascade,
  application_id uuid,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','doing','blocked','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sponsor campaigns + explicit lead consent
-- ---------------------------------------------------------------------------
create table if not exists public.sponsor_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_name text not null,
  website text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique(owner_user_id)
);

create table if not exists public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_account_id uuid not null references public.sponsor_accounts(id) on delete cascade,
  title text not null,
  description text,
  destination_url text not null,
  target_countries text[] not null default '{}',
  target_fields text[] not null default '{}',
  target_levels text[] not null default '{}',
  eligibility jsonb not null default '{}'::jsonb,
  budget_cents integer not null default 0,
  status text not null default 'draft' check (status in ('draft','review','active','paused','completed','rejected')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.sponsor_campaigns(id) on delete cascade,
  shared_fields text[] not null default '{}',
  consent_text text not null,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(user_id, campaign_id)
);

create table if not exists public.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsor_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_id uuid not null references public.lead_consents(id) on delete restrict,
  lead_data jsonb not null,
  match_score integer check (match_score between 0 and 100),
  status text not null default 'new' check (status in ('new','reviewed','contacted','qualified','applied','enrolled','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Program/referral network (feature 6)
-- ---------------------------------------------------------------------------
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  institution text not null,
  title text not null,
  country text,
  level text,
  field text,
  tuition_amount numeric,
  tuition_currency text,
  scholarships jsonb not null default '[]'::jsonb,
  eligibility jsonb not null default '{}'::jsonb,
  deadline text,
  official_url text not null,
  referral_enabled boolean not null default false,
  partner_disclosure text,
  verified boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(official_url)
);

create table if not exists public.program_referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  consent_text text not null,
  status text not null default 'requested' check (status in ('requested','sent','accepted','enrolled','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, program_id)
);

-- ---------------------------------------------------------------------------
-- Analytics + agent observability
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  event_name text not null,
  entity_type text,
  entity_id text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_analytics_events_event_time on public.analytics_events(event_name, created_at desc);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  status text not null default 'running',
  provider_chain jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.agent_runs(id) on delete cascade,
  agent_name text not null,
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Existing application table enrichments
-- ---------------------------------------------------------------------------
alter table if exists public.user_applications
  add column if not exists notes text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists last_activity_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid()
  ) or exists (
    select 1 from public.organizations o
    where o.id = org_id and o.owner_user_id = auth.uid()
  );
$$;

create or replace function public.current_plan_id()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select s.plan_id from public.subscriptions s
    where s.user_id = auth.uid() and s.status in ('active','trialing')
    order by s.updated_at desc limit 1
  ), 'free');
$$;

-- Public/reference tables
alter table public.plans enable row level security;
alter table public.programs enable row level security;
alter table public.opportunity_sources enable row level security;
alter table public.opportunity_versions enable row level security;
alter table public.opportunity_verifications enable row level security;

revoke all on public.plans, public.programs, public.opportunity_sources, public.opportunity_versions, public.opportunity_verifications from anon, authenticated;
grant select on public.plans, public.programs, public.opportunity_sources, public.opportunity_versions, public.opportunity_verifications to anon, authenticated;

drop policy if exists "plans are public" on public.plans;
create policy "plans are public" on public.plans for select to anon, authenticated using (active = true);
drop policy if exists "verified programs are public" on public.programs;
create policy "verified programs are public" on public.programs for select to anon, authenticated using (verified = true);
drop policy if exists "opportunity sources are public" on public.opportunity_sources;
create policy "opportunity sources are public" on public.opportunity_sources for select to anon, authenticated using (true);
drop policy if exists "opportunity versions are public" on public.opportunity_versions;
create policy "opportunity versions are public" on public.opportunity_versions for select to anon, authenticated using (true);
drop policy if exists "opportunity verifications are public" on public.opportunity_verifications;
create policy "opportunity verifications are public" on public.opportunity_verifications for select to anon, authenticated using (true);

-- User-owned tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['subscriptions','ai_usage','ai_generations','user_match_scores','user_watchlists','notification_deliveries','program_referrals'] LOOP
    EXECUTE format('alter table public.%I enable row level security', t);
    EXECUTE format('revoke all on public.%I from anon, authenticated', t);
    EXECUTE format('grant select, insert, update, delete on public.%I to authenticated', t);
  END LOOP;
END $$;

drop policy if exists "own subscriptions read" on public.subscriptions;
create policy "own subscriptions read" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
-- subscription writes happen only through service-role billing functions

drop policy if exists "own ai usage read" on public.ai_usage;
create policy "own ai usage read" on public.ai_usage for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own ai generations read" on public.ai_generations;
create policy "own ai generations read" on public.ai_generations for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own ai generations delete" on public.ai_generations;
create policy "own ai generations delete" on public.ai_generations for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "own match scores read" on public.user_match_scores;
create policy "own match scores read" on public.user_match_scores for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own watchlists read" on public.user_watchlists;
create policy "own watchlists read" on public.user_watchlists for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own watchlists insert" on public.user_watchlists;
create policy "own watchlists insert" on public.user_watchlists for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "own watchlists update" on public.user_watchlists;
create policy "own watchlists update" on public.user_watchlists for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own watchlists delete" on public.user_watchlists;
create policy "own watchlists delete" on public.user_watchlists for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "own notifications read" on public.notification_deliveries;
create policy "own notifications read" on public.notification_deliveries for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own referrals read" on public.program_referrals;
create policy "own referrals read" on public.program_referrals for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own referrals insert" on public.program_referrals;
create policy "own referrals insert" on public.program_referrals for insert to authenticated with check (auth.uid() = user_id);

-- Organizations / counselor
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.counselor_students enable row level security;
alter table public.tasks enable row level security;
revoke all on public.organizations, public.organization_members, public.counselor_students, public.tasks from anon, authenticated;
grant select, insert, update, delete on public.organizations, public.organization_members, public.counselor_students, public.tasks to authenticated;

drop policy if exists "org members see org" on public.organizations;
create policy "org members see org" on public.organizations for select to authenticated using (public.is_org_member(id));
drop policy if exists "users create owned org" on public.organizations;
create policy "users create owned org" on public.organizations for insert to authenticated with check (auth.uid() = owner_user_id);
drop policy if exists "owners update org" on public.organizations;
create policy "owners update org" on public.organizations for update to authenticated using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

drop policy if exists "members see membership" on public.organization_members;
create policy "members see membership" on public.organization_members for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "owners manage membership" on public.organization_members;
create policy "owners manage membership" on public.organization_members for all to authenticated using (exists(select 1 from public.organizations o where o.id=organization_id and o.owner_user_id=auth.uid())) with check (exists(select 1 from public.organizations o where o.id=organization_id and o.owner_user_id=auth.uid()));

drop policy if exists "org members manage students" on public.counselor_students;
create policy "org members manage students" on public.counselor_students for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists "task participants read" on public.tasks;
create policy "task participants read" on public.tasks for select to authenticated using (auth.uid()=user_id or auth.uid()=student_user_id or (organization_id is not null and public.is_org_member(organization_id)));
drop policy if exists "task owners insert" on public.tasks;
create policy "task owners insert" on public.tasks for insert to authenticated with check (auth.uid()=user_id and (organization_id is null or public.is_org_member(organization_id)));
drop policy if exists "task owners update" on public.tasks;
create policy "task owners update" on public.tasks for update to authenticated using (auth.uid()=user_id or (organization_id is not null and public.is_org_member(organization_id))) with check (auth.uid()=user_id or (organization_id is not null and public.is_org_member(organization_id)));
drop policy if exists "task owners delete" on public.tasks;
create policy "task owners delete" on public.tasks for delete to authenticated using (auth.uid()=user_id or (organization_id is not null and public.is_org_member(organization_id)));

-- Sponsor tables
alter table public.sponsor_accounts enable row level security;
alter table public.sponsor_campaigns enable row level security;
alter table public.lead_consents enable row level security;
alter table public.campaign_leads enable row level security;
revoke all on public.sponsor_accounts, public.sponsor_campaigns, public.lead_consents, public.campaign_leads from anon, authenticated;
grant select, insert, update, delete on public.sponsor_accounts, public.sponsor_campaigns, public.lead_consents, public.campaign_leads to authenticated;

drop policy if exists "sponsor owns account" on public.sponsor_accounts;
create policy "sponsor owns account" on public.sponsor_accounts for all to authenticated using (auth.uid()=owner_user_id) with check (auth.uid()=owner_user_id);

drop policy if exists "sponsor owns campaigns" on public.sponsor_campaigns;
create policy "sponsor owns campaigns" on public.sponsor_campaigns for all to authenticated
using (exists(select 1 from public.sponsor_accounts a where a.id=sponsor_account_id and a.owner_user_id=auth.uid()))
with check (exists(select 1 from public.sponsor_accounts a where a.id=sponsor_account_id and a.owner_user_id=auth.uid()));

drop policy if exists "users own lead consent" on public.lead_consents;
create policy "users own lead consent" on public.lead_consents for select to authenticated using (auth.uid()=user_id);
drop policy if exists "users insert lead consent" on public.lead_consents;
create policy "users insert lead consent" on public.lead_consents for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "users update lead consent" on public.lead_consents;
create policy "users update lead consent" on public.lead_consents for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "sponsor reads own leads" on public.campaign_leads;
create policy "sponsor reads own leads" on public.campaign_leads for select to authenticated using (
  exists(select 1 from public.sponsor_campaigns c join public.sponsor_accounts a on a.id=c.sponsor_account_id where c.id=campaign_id and a.owner_user_id=auth.uid())
);
drop policy if exists "sponsor updates own leads" on public.campaign_leads;
create policy "sponsor updates own leads" on public.campaign_leads for update to authenticated using (
  exists(select 1 from public.sponsor_campaigns c join public.sponsor_accounts a on a.id=c.sponsor_account_id where c.id=campaign_id and a.owner_user_id=auth.uid())
);

-- Analytics: clients can insert own/anonymous events; only own events can be read.
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;
drop policy if exists "analytics insert" on public.analytics_events;
create policy "analytics insert" on public.analytics_events for insert to anon, authenticated with check (user_id is null or auth.uid() = user_id);
drop policy if exists "own analytics read" on public.analytics_events;
create policy "own analytics read" on public.analytics_events for select to authenticated using (auth.uid() = user_id);

-- Agent observability is service-role only.
alter table public.agent_runs enable row level security;
alter table public.agent_events enable row level security;
revoke all on public.agent_runs, public.agent_events from anon, authenticated;

-- Existing user-owned tables. These tables are part of the current application.
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    EXECUTE 'alter table public.user_profiles enable row level security';
    EXECUTE 'revoke all on public.user_profiles from anon, authenticated';
    EXECUTE 'grant select, insert, update, delete on public.user_profiles to authenticated';
    EXECUTE 'drop policy if exists "users read own profiles" on public.user_profiles';
    EXECUTE 'create policy "users read own profiles" on public.user_profiles for select to authenticated using (auth.uid()=user_id)';
    EXECUTE 'drop policy if exists "users insert own profiles" on public.user_profiles';
    EXECUTE 'create policy "users insert own profiles" on public.user_profiles for insert to authenticated with check (auth.uid()=user_id)';
    EXECUTE 'drop policy if exists "users update own profiles" on public.user_profiles';
    EXECUTE 'create policy "users update own profiles" on public.user_profiles for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id)';
    EXECUTE 'drop policy if exists "users delete own profiles" on public.user_profiles';
    EXECUTE 'create policy "users delete own profiles" on public.user_profiles for delete to authenticated using (auth.uid()=user_id)';
  END IF;
  IF to_regclass('public.user_settings') IS NOT NULL THEN
    EXECUTE 'alter table public.user_settings enable row level security';
    EXECUTE 'revoke all on public.user_settings from anon, authenticated';
    EXECUTE 'grant select, insert, update, delete on public.user_settings to authenticated';
    EXECUTE 'drop policy if exists "users read own settings" on public.user_settings';
    EXECUTE 'create policy "users read own settings" on public.user_settings for select to authenticated using (auth.uid()=user_id)';
    EXECUTE 'drop policy if exists "users insert own settings" on public.user_settings';
    EXECUTE 'create policy "users insert own settings" on public.user_settings for insert to authenticated with check (auth.uid()=user_id)';
    EXECUTE 'drop policy if exists "users update own settings" on public.user_settings';
    EXECUTE 'create policy "users update own settings" on public.user_settings for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id)';
  END IF;
  IF to_regclass('public.user_applications') IS NOT NULL THEN
    EXECUTE 'alter table public.user_applications enable row level security';
    EXECUTE 'revoke all on public.user_applications from anon, authenticated';
    EXECUTE 'grant select, insert, update, delete on public.user_applications to authenticated';
    EXECUTE 'drop policy if exists "users read own applications" on public.user_applications';
    EXECUTE 'create policy "users read own applications" on public.user_applications for select to authenticated using (auth.uid()=user_id)';
    EXECUTE 'drop policy if exists "users insert own applications" on public.user_applications';
    EXECUTE 'create policy "users insert own applications" on public.user_applications for insert to authenticated with check (auth.uid()=user_id)';
    EXECUTE 'drop policy if exists "users update own applications" on public.user_applications';
    EXECUTE 'create policy "users update own applications" on public.user_applications for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id)';
    EXECUTE 'drop policy if exists "users delete own applications" on public.user_applications';
    EXECUTE 'create policy "users delete own applications" on public.user_applications for delete to authenticated using (auth.uid()=user_id)';
  END IF;
END $$;

-- Global opportunity grants. Anonymous/authenticated users may read; only service-role writes.
DO $$
BEGIN
  IF to_regclass('public.global_opportunities') IS NOT NULL THEN
    EXECUTE 'alter table public.global_opportunities enable row level security';
    EXECUTE 'revoke all on public.global_opportunities from anon, authenticated';
    EXECUTE 'grant select on public.global_opportunities to anon, authenticated';
    EXECUTE 'drop policy if exists "opportunities public read" on public.global_opportunities';
    EXECUTE 'create policy "opportunities public read" on public.global_opportunities for select to anon, authenticated using (true)';
  END IF;
END $$;

-- Students can discover active sponsor campaigns, but never other campaign states.
drop policy if exists "students see active campaigns" on public.sponsor_campaigns;
create policy "students see active campaigns" on public.sponsor_campaigns for select to authenticated using (status = 'active' or exists(select 1 from public.sponsor_accounts a where a.id=sponsor_account_id and a.owner_user_id=auth.uid()));

-- A counselor invitation is visible/acceptable only to the authenticated account with that email.
drop policy if exists "students see own counselor invitations" on public.counselor_students;
create policy "students see own counselor invitations" on public.counselor_students for select to authenticated using (lower(student_email) = lower(coalesce(auth.jwt()->>'email','')));
drop policy if exists "students accept own counselor invitations" on public.counselor_students;
create policy "students accept own counselor invitations" on public.counselor_students for update to authenticated
using (lower(student_email) = lower(coalesce(auth.jwt()->>'email','')))
with check (lower(student_email) = lower(coalesce(auth.jwt()->>'email','')) and student_user_id = auth.uid());

-- Richer profile facts used by deterministic eligibility and program matching.
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    EXECUTE 'alter table public.user_profiles add column if not exists citizenship text';
    EXECUTE 'alter table public.user_profiles add column if not exists desired_countries text[] not null default ''{}''';
    EXECUTE 'alter table public.user_profiles add column if not exists desired_degree text';
    EXECUTE 'alter table public.user_profiles add column if not exists gpa numeric';
    EXECUTE 'alter table public.user_profiles add column if not exists gpa_scale numeric';
    EXECUTE 'alter table public.user_profiles add column if not exists english_test jsonb not null default ''{}''::jsonb';
    EXECUTE 'alter table public.user_profiles add column if not exists budget_amount numeric';
    EXECUTE 'alter table public.user_profiles add column if not exists budget_currency text default ''USD''';
  END IF;
  IF to_regclass('public.user_settings') IS NOT NULL THEN
    EXECUTE 'alter table public.user_settings add column if not exists alert_countries_v2 text[] not null default ''{}''';
    EXECUTE 'alter table public.user_settings add column if not exists alert_levels_v2 text[] not null default ''{}''';
    EXECUTE 'alter table public.user_settings add column if not exists alert_fields_v2 text[] not null default ''{}''';
  END IF;
END $$;

-- Enforce plan watchlist limits in the database, not just the UI.
create or replace function public.enforce_watchlist_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare allowed integer; used integer;
begin
  select p.max_watchlists into allowed from public.plans p where p.id = coalesce((select s.plan_id from public.subscriptions s where s.user_id=new.user_id and s.status in ('active','trialing') order by s.updated_at desc limit 1),'free');
  select count(*) into used from public.user_watchlists w where w.user_id=new.user_id;
  if used >= coalesce(allowed,3) then raise exception 'Watchlist limit reached for your current plan'; end if;
  return new;
end $$;
drop trigger if exists trg_watchlist_limit on public.user_watchlists;
create trigger trg_watchlist_limit before insert on public.user_watchlists for each row execute function public.enforce_watchlist_limit();

-- Business workspaces require the corresponding paid plan.
drop policy if exists "users create owned org" on public.organizations;
create policy "users create owned org" on public.organizations for insert to authenticated
with check (auth.uid() = owner_user_id and (type not in ('counselor','agency') or public.current_plan_id() = 'counselor'));

drop policy if exists "sponsor owns account" on public.sponsor_accounts;
create policy "sponsor reads account" on public.sponsor_accounts for select to authenticated using (auth.uid()=owner_user_id);
create policy "sponsor creates paid account" on public.sponsor_accounts for insert to authenticated with check (auth.uid()=owner_user_id and public.current_plan_id()='sponsor');
create policy "sponsor updates account" on public.sponsor_accounts for update to authenticated using (auth.uid()=owner_user_id) with check (auth.uid()=owner_user_id);
create policy "sponsor deletes account" on public.sponsor_accounts for delete to authenticated using (auth.uid()=owner_user_id);

-- Optional social publication ledger used by the verified-content growth agent.
create table if not exists public.social_publications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.global_opportunities(id) on delete cascade,
  channel text not null,
  external_id text,
  published_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(opportunity_id, channel)
);
alter table public.social_publications enable row level security;
revoke all on public.social_publications from anon, authenticated;
