begin;

-- The audit guard is invoked only by its trigger.
revoke all on function public.reject_audit_mutation() from public, anon, authenticated;

commit;

