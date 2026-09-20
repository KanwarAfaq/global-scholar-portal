-- ScholarPortal admin control plane
-- Centralized settings + immutable admin mutation trail.

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource text not null,
  resource_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at desc);
create index if not exists idx_admin_audit_logs_resource on public.admin_audit_logs(resource, resource_id);

alter table public.platform_settings enable row level security;
alter table public.admin_audit_logs enable row level security;
-- No browser policies are intentional. The service-role-backed admin API is the only access path.

insert into public.platform_settings(key,value,description)
values
  ('branding', '{"product_name":"ScholarPortal","primary":"indigo","accent":"cyan"}'::jsonb, 'Product identity and visual defaults'),
  ('maintenance', '{"enabled":false,"message":"ScholarPortal is temporarily under maintenance."}'::jsonb, 'Maintenance-mode controls'),
  ('trust', '{"auto_publish_min_confidence":88,"program_auto_publish_min_confidence":80,"require_official_source":true}'::jsonb, 'Verification and publishing thresholds'),
  ('notifications', '{"email_enabled":true,"line_enabled":true,"deadline_days":[30,14,7,3,1]}'::jsonb, 'Global delivery switches and reminder cadence'),
  ('monetization', '{"sponsor_leads_enabled":true,"referrals_enabled":true}'::jsonb, 'Commercial feature switches'),
  ('ai', '{"enabled":true,"abuse_guard_enabled":true,"save_generation_history":true}'::jsonb, 'AI gateway global controls')
on conflict (key) do nothing;
