import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user, admin } = await requireUser(req);
    const out: any = { exported_at: new Date().toISOString(), user: { id: user.id, email: user.email, created_at: user.created_at, user_metadata: user.user_metadata } };
    const ownTables = ['user_profiles','user_settings','user_applications','user_watchlists','user_match_scores','ai_generations','ai_usage','notification_deliveries','lead_consents','campaign_leads','program_referrals','analytics_events'];
    for (const table of ownTables) {
      const { data, error } = await admin.from(table).select('*').eq('user_id', user.id);
      out[table] = error ? { error: error.message } : data;
    }
    const [{ data: counselorLinks, error: counselorError }, { data: studentTasks, error: taskError }, { data: memberships, error: membershipError }, { data: ownedOrganizations, error: orgError }, { data: sponsorAccounts, error: sponsorError }] = await Promise.all([
      admin.from('counselor_students').select('*').eq('student_user_id', user.id),
      admin.from('tasks').select('*').or(`user_id.eq.${user.id},student_user_id.eq.${user.id}`),
      admin.from('organization_members').select('*').eq('user_id', user.id),
      admin.from('organizations').select('*').eq('owner_user_id', user.id),
      admin.from('sponsor_accounts').select('*').eq('owner_user_id', user.id),
    ]);
    out.counselor_students = counselorError ? { error: counselorError.message } : counselorLinks;
    out.tasks = taskError ? { error: taskError.message } : studentTasks;
    out.organization_members = membershipError ? { error: membershipError.message } : memberships;
    out.owned_organizations = orgError ? { error: orgError.message } : ownedOrganizations;
    out.sponsor_accounts = sponsorError ? { error: sponsorError.message } : sponsorAccounts;
    return json(out);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Export failed' }, 500);
  }
});
