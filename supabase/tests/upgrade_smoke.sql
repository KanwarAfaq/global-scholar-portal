-- Read-only; all flags should be true after migration 202609170006.
select to_regclass('public.content_jobs') is not null as content_jobs_exists,
       to_regprocedure('public.claim_content_job(text,text)') is not null as claim_rpc_exists,
       to_regprocedure('public.opportunity_article_status(uuid)') is not null as public_status_rpc_exists;
select column_name,is_nullable from information_schema.columns
where table_schema='public' and table_name='user_match_scores'
and column_name in ('assessment_version','competitiveness_score');
select column_name from information_schema.columns
where table_schema='public' and table_name='plans'
and column_name in ('price_amount','price_currency','billing_interval');
select relrowsecurity as job_rls_enabled from pg_class where oid='public.content_jobs'::regclass;
select not has_table_privilege('anon','public.content_jobs','SELECT') as anonymous_jobs_private,
       not has_table_privilege('authenticated','public.content_jobs','UPDATE') as authenticated_jobs_protected,
       not has_function_privilege('authenticated','public.claim_content_job(text,text)','EXECUTE') as claim_service_only;
select tgname,tgenabled from pg_trigger where tgrelid='public.admin_audit_logs'::regclass and tgname='audit_append_only';
select kind,status,count(*) from public.content_jobs group by kind,status order by kind,status;
-- Finds missing/null opportunity articles without mutating any data.
select o.id,o.title from public.global_opportunities o
where o.verified=true and not exists(select 1 from public.opportunity_blogs b where b.opportunity_id=o.id and length(trim(b.content))>0)
limit 20;
