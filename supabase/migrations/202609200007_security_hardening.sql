begin;

-- Trigger functions are internal implementation details and must not be callable
-- through the Data API. Helper functions retain only their intended audience.
alter function public.reject_audit_mutation() set search_path = public;

revoke all on function public.enforce_watchlist_limit() from public, anon, authenticated;
revoke all on function public.prepare_content_comment() from public, anon, authenticated;

revoke all on function public.current_plan_id() from public, anon, authenticated;
grant execute on function public.current_plan_id() to authenticated;

revoke all on function public.is_org_member(uuid) from public, anon, authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;

-- This deliberately exposes only the public article publication state.
revoke all on function public.opportunity_article_status(uuid) from public;
grant execute on function public.opportunity_article_status(uuid) to anon, authenticated;

commit;

