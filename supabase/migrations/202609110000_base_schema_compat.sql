-- ScholarPortal base-schema compatibility layer.
-- Safe for the existing project: creates legacy/core tables only when missing and
-- adds columns used by the current frontend/agents when they do not already exist.
-- This migration intentionally runs before the commercial/trust migrations.

create extension if not exists pgcrypto;

create table if not exists public.global_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  organization text,
  country text,
  type text,
  field text,
  funding_details text,
  description text,
  tags text[] not null default '{}',
  deadline text,
  url text,
  source_url text,
  created_at timestamptz not null default now()
);
alter table public.global_opportunities
  add column if not exists organization text,
  add column if not exists country text,
  add column if not exists type text,
  add column if not exists field text,
  add column if not exists funding_details text,
  add column if not exists description text,
  add column if not exists tags text[] default '{}',
  add column if not exists deadline text,
  add column if not exists url text,
  add column if not exists source_url text,
  add column if not exists created_at timestamptz default now();

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_name text not null default 'Profile',
  full_name text,
  contact_email text,
  phone text,
  location text,
  website text,
  linkedin text,
  github text,
  bio text,
  avatar_url text,
  research_interests jsonb not null default '[]'::jsonb,
  technical_skills jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  publications jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  awards jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles
  add column if not exists profile_name text default 'Profile',
  add column if not exists full_name text,
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists location text,
  add column if not exists website text,
  add column if not exists linkedin text,
  add column if not exists github text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists research_interests jsonb default '[]'::jsonb,
  add column if not exists technical_skills jsonb default '[]'::jsonb,
  add column if not exists education jsonb default '[]'::jsonb,
  add column if not exists experience jsonb default '[]'::jsonb,
  add column if not exists publications jsonb default '[]'::jsonb,
  add column if not exists projects jsonb default '[]'::jsonb,
  add column if not exists awards jsonb default '[]'::jsonb,
  add column if not exists certifications jsonb default '[]'::jsonb,
  add column if not exists languages jsonb default '[]'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
create index if not exists idx_user_profiles_user on public.user_profiles(user_id, updated_at desc);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_alerts_enabled boolean not null default false,
  line_alerts_enabled boolean not null default false,
  line_user_id text,
  line_verification_code text,
  alert_frequency text not null default 'weekly',
  alert_countries text not null default 'All',
  alert_levels text not null default 'All',
  alert_fields text not null default 'All',
  default_route text not null default '/dashboard',
  timezone text not null default 'UTC',
  ai_summary_detail text not null default 'short',
  currency text not null default 'USD',
  theme_preference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_settings
  add column if not exists email_alerts_enabled boolean default false,
  add column if not exists line_alerts_enabled boolean default false,
  add column if not exists line_user_id text,
  add column if not exists line_verification_code text,
  add column if not exists alert_frequency text default 'weekly',
  add column if not exists alert_countries text default 'All',
  add column if not exists alert_levels text default 'All',
  add column if not exists alert_fields text default 'All',
  add column if not exists default_route text default '/dashboard',
  add column if not exists timezone text default 'UTC',
  add column if not exists ai_summary_detail text default 'short',
  add column if not exists currency text default 'USD',
  add column if not exists theme_preference text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.user_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.global_opportunities(id) on delete cascade,
  status text not null default 'col-1',
  created_at timestamptz not null default now(),
  unique(user_id, opportunity_id)
);
alter table public.user_applications
  add column if not exists status text default 'col-1',
  add column if not exists created_at timestamptz default now();
create index if not exists idx_user_applications_user on public.user_applications(user_id, created_at desc);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null default '',
  image text,
  tags text[] not null default '{}',
  read_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts
  add column if not exists excerpt text,
  add column if not exists content text default '',
  add column if not exists image text,
  add column if not exists tags text[] default '{}',
  add column if not exists read_time text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.opportunity_blogs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.global_opportunities(id) on delete cascade,
  title text not null,
  excerpt text,
  content text not null default '',
  image text,
  tags text[] not null default '{}',
  read_time text,
  original_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.opportunity_blogs
  add column if not exists opportunity_id uuid references public.global_opportunities(id) on delete cascade,
  add column if not exists excerpt text,
  add column if not exists image text,
  add column if not exists tags text[] default '{}',
  add column if not exists read_time text,
  add column if not exists original_link text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
create index if not exists idx_opportunity_blogs_opportunity on public.opportunity_blogs(opportunity_id);

-- Public content is readable; browser writes are not allowed. Admin/content agents use service role.
alter table public.blog_posts enable row level security;
alter table public.opportunity_blogs enable row level security;
revoke all on public.blog_posts, public.opportunity_blogs from anon, authenticated;
grant select on public.blog_posts, public.opportunity_blogs to anon, authenticated;
drop policy if exists "blog posts public read" on public.blog_posts;
create policy "blog posts public read" on public.blog_posts for select to anon, authenticated using (true);
drop policy if exists "opportunity blogs public read" on public.opportunity_blogs;
create policy "opportunity blogs public read" on public.opportunity_blogs for select to anon, authenticated using (true);
