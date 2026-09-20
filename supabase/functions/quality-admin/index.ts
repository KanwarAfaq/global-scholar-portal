import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';


async function audit(admin: any, userId: string, action: string, resource: string, resourceId: string | null, beforeData: any = null, afterData: any = null, metadata: any = {}) {
  await admin.from('admin_audit_logs').insert({ actor_user_id:userId, action, resource, resource_id:resourceId, before_data:beforeData, after_data:afterData, metadata });
}

function isStaff(user: any) {
  const role = String(user?.app_metadata?.role || '').toLowerCase();
  return role === 'admin' || role === 'staff';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user, admin } = await requireUser(req);
    if (!isStaff(user)) return json({ error: 'Staff access required' }, 403);

    if (req.method === 'GET') {
      const [{ data: queue, error: qErr }, { data: runs }, { data: events }, { data: referrals }, { data: sponsorAccounts }, { data: campaigns }] = await Promise.all([
        admin.from('opportunity_review_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
        admin.from('agent_runs').select('*').order('started_at', { ascending: false }).limit(20),
        admin.from('agent_events').select('*').in('level', ['warn','error']).order('created_at', { ascending: false }).limit(30),
        admin.from('program_referrals').select('*,programs(institution,title,country)').eq('status','requested').order('created_at',{ascending:false}).limit(30),
        admin.from('sponsor_accounts').select('*').eq('verified',false).order('created_at',{ascending:false}).limit(30),
        admin.from('sponsor_campaigns').select('*,sponsor_accounts(organization_name,verified)').eq('status','review').order('created_at',{ascending:false}).limit(50),
      ]);
      if (qErr) throw qErr;
      return json({ queue: queue || [], runs: runs || [], events: events || [], referrals: referrals || [], sponsorAccounts: sponsorAccounts || [], campaigns: campaigns || [] });
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const body = await req.json();
    const action = String(body.action || '');

    if (['approve','reject'].includes(action)) {
      const { data: item, error } = await admin.from('opportunity_review_queue').select('*').eq('id', body.id).eq('status','pending').single();
      if (error || !item) return json({ error: 'Review item not found' }, 404);
      if (action === 'reject') {
        await admin.from('opportunity_review_queue').update({ status:'rejected', reviewed_by:user.id, reviewed_at:new Date().toISOString(), review_note:String(body.note||''), updated_at:new Date().toISOString() }).eq('id', item.id);
        await audit(admin,user.id,'quality_reject','opportunity_review_queue',item.id,{status:item.status},{status:'rejected'},{source_url:item.source_url});
        return json({ ok:true, status:'rejected' });
      }
      const d = item.candidate_data || {};
      if (!d.title || !item.source_url) return json({ error:'Candidate is missing a title or source URL' },400);
      const payload = {
        title:d.title, organization:d.organization || new URL(item.source_url).hostname,
        country:d.country || 'Global', type:d.type || 'Scholarship', field:d.field || 'All Fields',
        funding_details:d.funding_details || 'See official source', description:d.description || 'Staff-reviewed opportunity. See official source.',
        tags:Array.isArray(d.tags)?d.tags:[], deadline:d.deadline || 'Unknown', url:item.source_url, source_url:item.source_url,
        official_source_url:item.source_url, verified:true, verification_status:'verified_by_staff',
        verification_confidence:item.verification_score, verified_at:new Date().toISOString(), last_checked_at:new Date().toISOString(),
        requirements:d.requirements || {}, eligibility:d.eligibility || {}, application_requirements:d.application_requirements || {},
        change_hash:item.page_metadata?.content_hash || null,
      };
      const { data: existing } = await admin.from('global_opportunities').select('id').eq('source_url', item.source_url).maybeSingle();
      let opportunityId = existing?.id;
      if (!opportunityId) {
        const { data: row, error: insertError } = await admin.from('global_opportunities').insert(payload).select('*').single();
        if (insertError) throw insertError;
        opportunityId = row.id;
        await admin.from('opportunity_sources').insert({ opportunity_id:row.id, source_url:item.source_url, source_domain:new URL(item.source_url).hostname, source_type:'official', is_official:true, http_status:item.page_metadata?.http_status || null, content_hash:item.page_metadata?.content_hash || null, metadata:{ review_queue_id:item.id, fetch_strategy:item.page_metadata?.fetch_strategy || null } });
        await admin.from('opportunity_versions').insert({ opportunity_id:row.id, content_hash:item.page_metadata?.content_hash || `staff-${item.id}`, snapshot:d, changed_fields:['created_by_staff_review'] });
        await admin.from('opportunity_verifications').insert({ opportunity_id:row.id, status:'verified', confidence:item.verification_score, checks:item.checks || {}, evidence:[item.source_url], verifier:`staff:${user.id}` });
      }
      await admin.from('opportunity_review_queue').update({ status:'approved', reviewed_by:user.id, reviewed_at:new Date().toISOString(), review_note:String(body.note||''), updated_at:new Date().toISOString() }).eq('id', item.id);
      await audit(admin,user.id,'quality_approve','opportunity_review_queue',item.id,{status:item.status},{status:'approved',opportunity_id:opportunityId},{source_url:item.source_url});
      return json({ ok:true, status:'approved', opportunityId });
    }

    if (action === 'sponsor_verify') {
      const { error } = await admin.from('sponsor_accounts').update({ verified:Boolean(body.verified) }).eq('id',body.id);
      if (error) throw error;
      await audit(admin,user.id,'sponsor_verify','sponsor_accounts',String(body.id),null,{verified:Boolean(body.verified)});
      return json({ ok:true });
    }

    if (action === 'campaign_status') {
      const allowed = ['active','rejected','paused','completed'];
      if (!allowed.includes(body.status)) return json({ error:'Invalid campaign status' },400);
      if (body.status === 'active') {
        const { data: campaign } = await admin.from('sponsor_campaigns').select('sponsor_account_id,sponsor_accounts(verified)').eq('id',body.id).single();
        if (!campaign?.sponsor_accounts?.verified) return json({ error:'Verify the sponsor before activating its campaign' },400);
      }
      const { error } = await admin.from('sponsor_campaigns').update({ status:body.status, updated_at:new Date().toISOString() }).eq('id',body.id);
      if (error) throw error;
      await audit(admin,user.id,'campaign_status','sponsor_campaigns',String(body.id),null,{status:body.status});
      return json({ ok:true });
    }

    if (action === 'referral_status') {
      const allowed = ['requested','sent','accepted','enrolled','declined'];
      if (!allowed.includes(body.status)) return json({ error:'Invalid referral status' },400);
      const { error } = await admin.from('program_referrals').update({ status:body.status, updated_at:new Date().toISOString() }).eq('id',body.id);
      if (error) throw error;
      await audit(admin,user.id,'referral_status','program_referrals',String(body.id),null,{status:body.status});
      return json({ ok:true });
    }

    return json({ error:'Unsupported action' },400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Quality console failed' }, 500);
  }
});
