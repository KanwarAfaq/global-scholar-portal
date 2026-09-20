begin;
alter table public.plans add column if not exists price_amount numeric check (price_amount>=0), add column if not exists price_currency text default 'USD', add column if not exists billing_interval text default 'month';
alter table public.global_opportunities add column if not exists logo_url text, add column if not exists source_audit jsonb default '{}';
alter table public.user_match_scores add column if not exists assessment_version text;
-- Unknown competitiveness is not a zero probability of success.
alter table public.user_match_scores alter column competitiveness_score drop not null;
create table if not exists public.content_jobs (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('standalone','opportunity')), entity_key text not null,
 status text not null default 'pending' check(status in ('pending','running','published','failed')),
 attempts integer not null default 0, lease_until timestamptz, last_error text, provider text, model text,
 updated_at timestamptz not null default now(), unique(kind,entity_key)
);
alter table public.content_jobs enable row level security;
revoke all on public.content_jobs from anon,authenticated;
grant all on public.content_jobs to service_role;
create or replace function public.claim_content_job(job_kind text, job_key text) returns boolean
language plpgsql security definer set search_path=public as $$
declare claimed uuid;
begin
 insert into content_jobs(kind,entity_key) values(job_kind,job_key) on conflict do nothing;
 update content_jobs set status='running',attempts=attempts+1,lease_until=now()+interval '15 minutes',updated_at=now()
 where kind=job_kind and entity_key=job_key and (status in ('pending','failed','published') or lease_until<now()) returning id into claimed;
 return claimed is not null;
end $$;
revoke all on function public.claim_content_job(text,text) from public,anon,authenticated;
grant execute on function public.claim_content_job(text,text) to service_role;
create or replace function public.opportunity_article_status(opportunity uuid) returns text
language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from opportunity_blogs where opportunity_id=opportunity and length(trim(content))>0) then 'published'
 else coalesce((select status from content_jobs where kind='opportunity' and entity_key=opportunity::text),'pending') end;
$$;
revoke all on function public.opportunity_article_status(uuid) from public;
grant execute on function public.opportunity_article_status(uuid) to anon,authenticated;
-- Protect audit evidence, including against accidental service-role updates.
create or replace function public.reject_audit_mutation() returns trigger language plpgsql as $$
begin
 -- Retain evidence while honoring the existing ON DELETE SET NULL identity FK.
 if TG_OP='UPDATE' and NEW.actor_user_id is null and OLD.actor_user_id is not null
    and (to_jsonb(NEW)-'actor_user_id')=(to_jsonb(OLD)-'actor_user_id') then return NEW; end if;
 raise exception 'Audit records are append-only';
end $$;
drop trigger if exists audit_append_only on public.admin_audit_logs;
create trigger audit_append_only before update or delete on public.admin_audit_logs for each row execute function public.reject_audit_mutation();
commit;
