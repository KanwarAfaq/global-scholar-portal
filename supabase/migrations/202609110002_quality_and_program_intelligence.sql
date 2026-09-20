-- ScholarPortal quality review queue and program verification metadata.
-- Run after 202609110001_commercial_platform.sql.

create table if not exists public.opportunity_review_queue (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  search_title text,
  candidate_data jsonb not null default '{}'::jsonb,
  page_metadata jsonb not null default '{}'::jsonb,
  verification_score integer not null default 0 check (verification_score between 0 and 100),
  checks jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_url, status)
);
alter table public.opportunity_review_queue enable row level security;
revoke all on public.opportunity_review_queue from anon, authenticated;

alter table public.programs add column if not exists verification_status text not null default 'verified';
alter table public.programs add column if not exists verification_confidence integer check (verification_confidence between 0 and 100);
alter table public.programs add column if not exists content_hash text;
alter table public.programs add column if not exists source_domain text;
alter table public.programs add column if not exists requirements jsonb not null default '{}'::jsonb;

alter table public.program_referrals add column if not exists profile_id uuid references public.user_profiles(id) on delete set null;
alter table public.program_referrals add column if not exists referral_data jsonb not null default '{}'::jsonb;

-- Admin/staff access remains server-side through the quality-admin Edge Function.
-- Do not grant browser access to the review queue or agent observability tables.
