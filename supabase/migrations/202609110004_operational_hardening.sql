-- Operational hardening: visible in-app alerts, safer LINE linking, and useful indexes.

alter table public.notification_deliveries
  add column if not exists read_at timestamptz;

drop policy if exists "own notifications update" on public.notification_deliveries;
create policy "own notifications update" on public.notification_deliveries
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.user_settings
  add column if not exists line_verification_expires_at timestamptz;

-- A verification code should map to at most one account while it is active.
create unique index if not exists idx_user_settings_line_verification_code_unique
  on public.user_settings(line_verification_code)
  where line_verification_code is not null;

create index if not exists idx_notification_deliveries_user_unread
  on public.notification_deliveries(user_id, read_at, sent_at desc);
create index if not exists idx_program_referrals_user on public.program_referrals(user_id, created_at desc);
create index if not exists idx_campaign_leads_user on public.campaign_leads(user_id, created_at desc);

-- The application uses upsert(..., onConflict:'user_id') and treats an
-- application/opportunity pair as unique. These indexes make those contracts
-- explicit for fresh installs and guard production data from duplicates.
create unique index if not exists idx_user_settings_user_id_unique
  on public.user_settings(user_id);
create unique index if not exists idx_user_applications_user_opportunity_unique
  on public.user_applications(user_id, opportunity_id);
