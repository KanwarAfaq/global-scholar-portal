-- Auth OTP, community engagement, and granular notification preferences.
create extension if not exists pgcrypto;

create table if not exists public.auth_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('login','reset')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  request_ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_auth_otp_email_purpose_created on public.auth_otp_challenges(lower(email), purpose, created_at desc);
alter table public.auth_otp_challenges enable row level security;
revoke all on public.auth_otp_challenges from anon, authenticated;

alter table public.user_settings
  add column if not exists in_app_alerts_enabled boolean not null default true,
  add column if not exists notify_new_matches boolean not null default true,
  add column if not exists notify_watchlist_changes boolean not null default true,
  add column if not exists notify_deadline_reminders boolean not null default true,
  add column if not exists notify_application_updates boolean not null default true,
  add column if not exists notify_sponsor_matches boolean not null default true,
  add column if not exists notify_counselor_tasks boolean not null default true,
  add column if not exists notify_referral_updates boolean not null default true,
  add column if not exists notify_product_news boolean not null default false,
  add column if not exists urgent_change_alerts boolean not null default true;

create table if not exists public.content_reactions (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('blog','opportunity')),
  content_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'like' check (reaction='like'),
  created_at timestamptz not null default now(),
  unique(content_type, content_id, user_id, reaction)
);
create index if not exists idx_content_reactions_target on public.content_reactions(content_type, content_id, created_at desc);

create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('blog','opportunity')),
  content_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.content_comments(id) on delete cascade,
  author_name text not null default 'Scholar',
  body text not null check (char_length(trim(body)) between 1 and 3000),
  status text not null default 'approved' check (status in ('approved','pending','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_content_comments_target on public.content_comments(content_type, content_id, created_at asc);
create index if not exists idx_content_comments_parent on public.content_comments(parent_id);

create or replace function public.prepare_content_comment()
returns trigger language plpgsql security definer set search_path=public as $$
declare display_name text;
begin
  new.user_id := auth.uid();
  if new.user_id is null then raise exception 'Authentication required'; end if;
  select coalesce(nullif(trim(full_name),''), nullif(trim(profile_name),'')) into display_name
  from public.user_profiles where user_id=new.user_id order by updated_at desc nulls last limit 1;
  if display_name is null then
    select coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1), 'Scholar') into display_name
    from auth.users where id=new.user_id;
  end if;
  new.author_name := left(coalesce(display_name,'Scholar'),120);
  new.body := trim(new.body);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_prepare_content_comment on public.content_comments;
create trigger trg_prepare_content_comment before insert or update on public.content_comments
for each row execute function public.prepare_content_comment();

alter table public.content_reactions enable row level security;
alter table public.content_comments enable row level security;
grant select on public.content_reactions, public.content_comments to anon, authenticated;
grant insert, delete on public.content_reactions to authenticated;
grant insert, update, delete on public.content_comments to authenticated;

drop policy if exists "public read reactions" on public.content_reactions;
create policy "public read reactions" on public.content_reactions for select to anon, authenticated using (true);
drop policy if exists "users add own reactions" on public.content_reactions;
create policy "users add own reactions" on public.content_reactions for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "users delete own reactions" on public.content_reactions;
create policy "users delete own reactions" on public.content_reactions for delete to authenticated using (auth.uid()=user_id);

drop policy if exists "public read approved comments" on public.content_comments;
create policy "public read approved comments" on public.content_comments for select to anon, authenticated using (status='approved' or auth.uid()=user_id);
drop policy if exists "users add own comments" on public.content_comments;
create policy "users add own comments" on public.content_comments for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "users update own comments" on public.content_comments;
create policy "users update own comments" on public.content_comments for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "users delete own comments" on public.content_comments;
create policy "users delete own comments" on public.content_comments for delete to authenticated using (auth.uid()=user_id);

alter table public.global_opportunities
  add column if not exists safety_risk_score int not null default 0,
  add column if not exists safety_flags jsonb not null default '[]'::jsonb,
  add column if not exists freshness_score int not null default 100;

-- Service-role-only existence check used by the custom 4-digit login/reset flow.
-- This prevents magic-link generation from accidentally creating an unknown user.
create or replace function public.auth_user_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select exists(
    select 1 from auth.users
    where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.auth_user_exists(text) from public, anon, authenticated;
grant execute on function public.auth_user_exists(text) to service_role;
