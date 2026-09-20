-- ScholarPortal post-migration smoke checks. Read-only.
-- Run in Supabase SQL Editor after every migration through 202609130005.

select 'global_opportunities' as object, to_regclass('public.global_opportunities') is not null as exists
union all select 'user_profiles', to_regclass('public.user_profiles') is not null
union all select 'user_settings', to_regclass('public.user_settings') is not null
union all select 'plans', to_regclass('public.plans') is not null
union all select 'subscriptions', to_regclass('public.subscriptions') is not null
union all select 'user_watchlists', to_regclass('public.user_watchlists') is not null
union all select 'notification_deliveries', to_regclass('public.notification_deliveries') is not null
union all select 'sponsor_campaigns', to_regclass('public.sponsor_campaigns') is not null
union all select 'counselor_students', to_regclass('public.counselor_students') is not null
union all select 'programs', to_regclass('public.programs') is not null
union all select 'opportunity_review_queue', to_regclass('public.opportunity_review_queue') is not null
union all select 'platform_settings', to_regclass('public.platform_settings') is not null
union all select 'admin_audit_logs', to_regclass('public.admin_audit_logs') is not null
union all select 'auth_otp_challenges', to_regclass('public.auth_otp_challenges') is not null
union all select 'content_reactions', to_regclass('public.content_reactions') is not null
union all select 'content_comments', to_regclass('public.content_comments') is not null;

select key, value from public.platform_settings order by key;
select id, name, audience, monthly_ai_credits, max_watchlists, active from public.plans order by id;

select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='user_settings'
  and column_name in (
    'in_app_alerts_enabled','email_alerts_enabled','line_alerts_enabled','alert_frequency',
    'notify_new_matches','notify_watchlist_changes','notify_deadline_reminders',
    'notify_application_updates','notify_sponsor_matches','notify_counselor_tasks',
    'notify_referral_updates','notify_product_news','urgent_change_alerts'
  )
order by column_name;

select routine_name
from information_schema.routines
where routine_schema='public' and routine_name='auth_user_exists';

select tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in (
    'user_profiles','user_settings','user_applications','user_watchlists','user_match_scores',
    'notification_deliveries','ai_generations','ai_usage','subscriptions',
    'organizations','organization_members','counselor_students','tasks',
    'sponsor_accounts','sponsor_campaigns','lead_consents','campaign_leads','program_referrals',
    'auth_otp_challenges','content_reactions','content_comments'
  )
order by tablename;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname='public'
order by tablename, policyname;
