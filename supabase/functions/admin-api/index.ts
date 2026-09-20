import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const MAX_PAGE_SIZE = 100;
const roleOf = (user: any) => String(user?.app_metadata?.role || 'user').toLowerCase();
const isAdmin = (user: any) => roleOf(user) === 'admin';

const resources: Record<string, any> = {
  opportunities: { table:'global_opportunities', order:'created_at', search:['title','organization','country','field','type'], editable:['logo_url','title','organization','country','type','field','funding_details','description','tags','deadline','url','source_url','official_source_url','verified','verification_status','verification_confidence','requirements','eligibility','application_requirements','sponsored'], creatable:true, deletable:true },
  programs: { table:'programs', order:'created_at', search:['institution','title','country','level','field'], editable:['institution','title','country','level','field','tuition_amount','tuition_currency','scholarships','eligibility','deadline','official_url','referral_enabled','partner_disclosure','verified','last_checked_at'], creatable:true, deletable:true },
  user_profiles: { table:'user_profiles', order:'updated_at', search:['profile_name','full_name','contact_email','citizenship','desired_degree'], editable:['profile_name','full_name','contact_email','phone','location','website','linkedin','github','bio','avatar_url','research_interests','technical_skills','education','experience','publications','projects','awards','certifications','languages','citizenship','desired_countries','desired_degree','gpa','gpa_scale','english_test','budget_amount','budget_currency'], deletable:true },
  user_settings: { table:'user_settings', order:'updated_at', search:['alert_frequency','timezone','currency'], editable:['email_alerts_enabled','line_alerts_enabled','in_app_alerts_enabled','notify_new_matches','notify_watchlist_changes','notify_deadline_reminders','notify_application_updates','notify_sponsor_matches','notify_counselor_tasks','notify_referral_updates','notify_product_news','urgent_change_alerts','line_user_id','alert_frequency','alert_countries','alert_levels','alert_fields','alert_countries_v2','alert_levels_v2','alert_fields_v2','default_route','timezone','ai_summary_detail','currency','theme_preference'], deletable:true },
  opportunity_sources: { table:'opportunity_sources', order:'extracted_at', search:['source_url','source_domain','source_type'], editable:['source_url','source_domain','source_type','is_official','http_status','content_hash','metadata','last_checked_at'], deletable:true },
  opportunity_versions: { table:'opportunity_versions', order:'created_at', search:[], editable:['content_hash','snapshot','changed_fields'], deletable:true },
  opportunity_verifications: { table:'opportunity_verifications', order:'verified_at', search:['status','verifier','notes'], editable:['status','confidence','checks','evidence','verifier','notes','verified_at'], deletable:true },
  plans: { table:'plans', order:'created_at', id:'id', search:['id','name','audience'], editable:['id','name','audience','monthly_ai_credits','max_watchlists','features','active','price_amount','price_currency','billing_interval'], creatable:true, deletable:false },
  subscriptions: { table:'subscriptions', order:'updated_at', search:['plan_id','status','provider','provider_customer_id','provider_subscription_id'], editable:['user_id','plan_id','status','provider','provider_customer_id','provider_subscription_id','cancel_at_period_end','current_period_start','current_period_end'], creatable:true, deletable:false },
  sponsors: { table:'sponsor_accounts', order:'created_at', search:['organization_name','website'], editable:['owner_user_id','organization_name','website','verified'], creatable:true, deletable:true },
  campaigns: { table:'sponsor_campaigns', order:'created_at', search:['title','description','destination_url','status'], editable:['sponsor_account_id','title','description','destination_url','target_countries','target_fields','target_levels','eligibility','budget_cents','status','starts_at','ends_at'], creatable:true, deletable:true },
  leads: { table:'campaign_leads', order:'created_at', search:['status'], editable:['match_score','status','lead_data'], deletable:true },
  lead_consents: { table:'lead_consents', order:'consented_at', search:['consent_text'], editable:['shared_fields','revoked_at'], deletable:false },
  organizations: { table:'organizations', order:'created_at', search:['name','type','website','billing_email'], editable:['owner_user_id','name','type','website','logo_url','billing_email'], creatable:true, deletable:true },
  org_members: { table:'organization_members', order:'created_at', id:['organization_id','user_id'], search:['role'], editable:['role'], deletable:true },
  counselor_students: { table:'counselor_students', order:'created_at', search:['student_email','display_name','status'], editable:['student_email','display_name','status','consented_at'], deletable:true },
  tasks: { table:'tasks', order:'created_at', search:['title','description','status','priority'], editable:['title','description','status','priority','due_at','student_user_id','organization_id'], deletable:true },
  applications: { table:'user_applications', order:'last_activity_at', search:['status','notes'], editable:['status','notes','checklist','last_activity_at'], deletable:true },
  watchlists: { table:'user_watchlists', order:'created_at', search:[], editable:['notify_changes','notify_deadline'], deletable:true },
  match_scores: { table:'user_match_scores', order:'calculated_at', search:['explanation'], editable:['eligible','score','eligibility_score','relevance_score','competitiveness_score','matched_rules','warnings','explanation'], deletable:true },
  notifications: { table:'notification_deliveries', order:'sent_at', search:['channel','notification_type','status','delivery_key'], editable:['status','clicked_at','metadata'], deletable:true },
  ai_usage: { table:'ai_usage', order:'created_at', search:['action','provider','model'], editable:[], deletable:false },
  ai_generations: { table:'ai_generations', order:'created_at', search:['action','title','provider','model'], editable:['title','content','structured_output'], deletable:true },
  analytics: { table:'analytics_events', order:'created_at', search:['event_name','entity_type','entity_id'], editable:[], deletable:false },
  agent_runs: { table:'agent_runs', order:'started_at', search:['agent_name','status','error'], editable:['status','metrics','error','finished_at'], deletable:false },
  agent_events: { table:'agent_events', order:'created_at', search:['agent_name','level','message'], editable:['level','message','metadata'], deletable:true },
  reviews: { table:'opportunity_review_queue', order:'created_at', search:['search_title','source_url','status'], editable:['status','review_note'], deletable:true },
  referrals: { table:'program_referrals', order:'created_at', search:['status','consent_text'], editable:['status'], deletable:false },
  blog_posts: { table:'blog_posts', order:'created_at', search:['title','slug'], editable:['title','slug','content','excerpt','image','tags','read_time'], creatable:true, deletable:true },
  opportunity_blogs: { table:'opportunity_blogs', order:'created_at', search:['title','original_link'], editable:['title','content','image','tags','read_time','original_link'], creatable:true, deletable:true },
  comments: { table:'content_comments', order:'created_at', search:['content_type','content_id','author_name','body','status'], editable:['body','status'], deletable:true },
  reactions: { table:'content_reactions', order:'created_at', search:['content_type','content_id','reaction'], editable:[], deletable:true },
  social_publications: { table:'social_publications', order:'published_at', search:['channel','external_id'], editable:['channel','external_id','metadata','published_at'], deletable:true },
  settings: { table:'platform_settings', order:'key', id:'key', search:['key','description'], editable:['value','description'], deletable:false },
  audit: { table:'admin_audit_logs', order:'created_at', search:['action','resource','resource_id'], editable:[], deletable:false },
};

async function audit(admin:any, userId:string, action:string, resource:string, resourceId:string|null, beforeData:any, afterData:any, metadata:any={}) {
  await admin.from('admin_audit_logs').insert({ actor_user_id:userId, action, resource, resource_id:resourceId, before_data:beforeData || null, after_data:afterData || null, metadata });
}

function cleanSearch(value:any) {
  return String(value || '').trim().replace(/[,%()]/g, ' ').slice(0, 120);
}

function applyIdentity(query:any, cfg:any, identity:any) {
  if (Array.isArray(cfg.id)) {
    if (!identity || typeof identity !== 'object') throw new Error('Composite resource identity is missing');
    for (const field of cfg.id) query = query.eq(field, identity[field]);
    return query;
  }
  return query.eq(cfg.id || 'id', identity);
}

function identityText(cfg:any, row:any) {
  if (Array.isArray(cfg.id)) return cfg.id.map((field:string)=>`${field}=${row?.[field] ?? ''}`).join('|');
  return String(row?.[cfg.id || 'id'] ?? '');
}

async function countTable(admin:any, table:string, filter?:{column:string,value:any}) {
  let q = admin.from(table).select('*', { count:'exact', head:true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count, error } = await q;
  return error ? null : (count || 0);
}

async function authUsers(admin:any, page=1, perPage=50) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) throw error;
  return data.users || [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user, admin } = await requireUser(req);
    if (!isAdmin(user)) return json({ error:'Administrator access required' }, 403);
    if (req.method !== 'POST') return json({ error:'Method not allowed' }, 405);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'overview');

    if (action === 'overview') {
      const userRows = await authUsers(admin, 1, 1000);
      const [opportunities, verifiedOpportunities, programs, applications, subscriptions, proSubs, sponsors, campaigns, leads, counselorStudents, aiUsage, notifications, pendingReviews, pendingReferrals, recentRuns, recentAudit] = await Promise.all([
        countTable(admin,'global_opportunities'), countTable(admin,'global_opportunities',{column:'verified',value:true}), countTable(admin,'programs'), countTable(admin,'user_applications'), countTable(admin,'subscriptions'), countTable(admin,'subscriptions',{column:'status',value:'active'}), countTable(admin,'sponsor_accounts'), countTable(admin,'sponsor_campaigns'), countTable(admin,'campaign_leads'), countTable(admin,'counselor_students'), countTable(admin,'ai_usage'), countTable(admin,'notification_deliveries'), countTable(admin,'opportunity_review_queue',{column:'status',value:'pending'}), countTable(admin,'program_referrals',{column:'status',value:'requested'}), admin.from('agent_runs').select('*').order('started_at',{ascending:false}).limit(8), admin.from('admin_audit_logs').select('*').order('created_at',{ascending:false}).limit(8),
      ]);
      const roles = userRows.reduce((acc:any,u:any)=>{ const r=roleOf(u); acc[r]=(acc[r]||0)+1; return acc; },{});
      const { data: subsByPlan } = await admin.from('subscriptions').select('plan_id,status');
      const planMix = (subsByPlan || []).reduce((acc:any,s:any)=>{ if(['active','trialing'].includes(s.status)){acc[s.plan_id]=(acc[s.plan_id]||0)+1;} return acc;},{});
      return json({
        metrics:{ users:userRows.length, roles, opportunities, verifiedOpportunities, programs, applications, subscriptions, activeSubscriptions:proSubs, sponsors, campaigns, leads, counselorStudents, aiUsage, notifications, pendingReviews, pendingReferrals, planMix },
        recentRuns:recentRuns.data || [], recentAudit:recentAudit.data || []
      });
    }

    if (action === 'list_users') {
      const page = Math.max(1, Number(body.page || 1));
      const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body.limit || 50)));
      const search = String(body.search || '').trim().toLowerCase();
      let users:any[] = []; let count=0;
      if(search){
        // Search all auth pages, not only the currently displayed 50 users.
        for(let cursor=1;;cursor++){
          const batch=await authUsers(admin,cursor,1000);
          users.push(...batch.filter((u:any)=>[u.id,u.email,u.phone,u.user_metadata?.full_name,u.user_metadata?.name,roleOf(u)].some(v=>String(v||'').toLowerCase().includes(search))));
          if(batch.length<1000)break;
          if(cursor>=100)throw new Error('User search is too large; use the identity management console');
        }
        count=users.length;users=users.slice((page-1)*limit,page*limit);
      }else{
        const result=await admin.auth.admin.listUsers({page,perPage:limit});
        if(result.error)throw result.error;
        users=result.data.users||[];count=result.data.total??((page-1)*limit+users.length);
      }
      const ids = users.map((u:any)=>u.id);
      let subscriptionMap:any = {};
      if (ids.length) {
        const { data: subs } = await admin.from('subscriptions').select('user_id,plan_id,status,current_period_end').in('user_id',ids);
        subscriptionMap = (subs || []).reduce((acc:any,s:any)=>{acc[s.user_id]=s; return acc;},{});
      }
      return json({ count, rows:users.map((u:any)=>({ id:u.id,email:u.email,phone:u.phone,role:roleOf(u),created_at:u.created_at,last_sign_in_at:u.last_sign_in_at,banned_until:u.banned_until,user_metadata:u.user_metadata,subscription:subscriptionMap[u.id] || null })) });
    }

    if (action === 'list') {
      const name = String(body.resource || '');
      const cfg = resources[name];
      if (!cfg) return json({ error:'Unsupported admin resource' }, 400);
      const page = Math.max(1, Number(body.page || 1));
      const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body.limit || 50)));
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      let q = admin.from(cfg.table).select('*', { count:'exact' }).range(from,to);
      if (cfg.order) q = q.order(cfg.order, { ascending:false });
      const search = cleanSearch(body.search);
      if (search && cfg.search?.length) q = q.or(cfg.search.map((f:string)=>`${f}.ilike.%${search}%`).join(','));
      const { data, error, count } = await q;
      if (error) throw error;
      const rows=(data || []).map((row:any)=>Array.isArray(cfg.id)?{...row,_admin_id:Object.fromEntries(cfg.id.map((field:string)=>[field,row[field]]))}:row);
      return json({ rows, count:count || 0, editable:cfg.editable || [], creatable:Boolean(cfg.creatable), deletable:Boolean(cfg.deletable) });
    }

    if (action === 'update') {
      const name = String(body.resource || ''); const cfg = resources[name];
      if (!cfg) return json({ error:'Unsupported admin resource' },400);
      const id = body.id;
      if (id === null || id === undefined || id === '') return json({ error:'Missing resource id' },400);
      const updates:any = {};
      for (const key of cfg.editable || []) if (Object.prototype.hasOwnProperty.call(body.values || {}, key)) updates[key] = body.values[key];
      if (!Object.keys(updates).length) return json({ error:'No editable fields supplied' },400);
      if (name === 'settings') { updates.updated_by = user.id; updates.updated_at = new Date().toISOString(); }
      const { data: before } = await applyIdentity(admin.from(cfg.table).select('*'),cfg,id).maybeSingle();
      const { data: after, error } = await applyIdentity(admin.from(cfg.table).update(updates),cfg,id).select('*').single();
      if (error) throw error;
      await audit(admin,user.id,'update',name,identityText(cfg,before || after),before,after);
      return json({ ok:true,row:after });
    }

    if (action === 'create') {
      const name=String(body.resource||''); const cfg=resources[name];
      if (!cfg?.creatable) return json({ error:'Creation is not allowed for this resource' },400);
      const values:any={};
      for (const key of cfg.editable || []) if (Object.prototype.hasOwnProperty.call(body.values || {}, key)) values[key]=body.values[key];
      const { data:row,error }=await admin.from(cfg.table).insert(values).select('*').single();
      if(error) throw error;
      await audit(admin,user.id,'create',name,identityText(cfg,row),null,row);
      return json({ok:true,row});
    }

    if (action === 'delete') {
      const name=String(body.resource||''); const cfg=resources[name];
      if(!cfg?.deletable) return json({error:'Deletion is not allowed for this resource'},400);
      const id=body.id;
      if (id === null || id === undefined || id === '') return json({error:'Missing resource id'},400);
      const {data:before}=await applyIdentity(admin.from(cfg.table).select('*'),cfg,id).maybeSingle();
      const {error}=await applyIdentity(admin.from(cfg.table).delete(),cfg,id); if(error) throw error;
      await audit(admin,user.id,'delete',name,identityText(cfg,before),before,null);
      return json({ok:true});
    }

    if (action === 'trigger_workflow') {
      const workflows: Record<string,string> = { agents:'opp_agent.yml', sitemap:'daily_scraper.yml' };
      const workflowKey=String(body.workflow||''); const workflow=workflows[workflowKey];
      if(!workflow) return json({error:'Unsupported workflow'},400);
      const token=Deno.env.get('GITHUB_ACTIONS_TOKEN'); const repo=Deno.env.get('GITHUB_REPOSITORY');
      if(!token || !repo) return json({error:'Set GITHUB_ACTIONS_TOKEN and GITHUB_REPOSITORY on the admin-api Edge Function to enable manual workflow runs.'},503);
      const response=await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify({ref:String(body.ref||'main')})});
      if(!response.ok){const detail=await response.text();return json({error:`GitHub workflow dispatch failed (${response.status}): ${detail.slice(0,300)}`},502);}
      await audit(admin,user.id,'trigger_workflow','operations',workflowKey,null,{workflow,ref:String(body.ref||'main')});
      return json({ok:true,workflow:workflowKey});
    }

    if (action === 'create_user') {
      const email=String(body.email||'').trim().toLowerCase(); const password=String(body.password||''); const role=String(body.role||'user').toLowerCase();
      if(!email || !email.includes('@')) return json({error:'A valid email is required'},400);
      if(password.length < 8) return json({error:'Temporary password must be at least 8 characters'},400);
      if(!['user','staff','admin'].includes(role)) return json({error:'Invalid role'},400);
      const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role}}); if(error) throw error;
      await audit(admin,user.id,'create_user','users',created.user?.id || null,null,{email,role});
      return json({ok:true,user:created.user});
    }

    if (action === 'user_role') {
      const target=String(body.id||''); const role=String(body.role||'user').toLowerCase();
      if(!['user','staff','admin'].includes(role)) return json({error:'Invalid role'},400);
      if(target===user.id && role!=='admin') return json({error:'You cannot remove your own administrator role'},400);
      const {data:before}=await admin.auth.admin.getUserById(target); if(!before?.user) return json({error:'User not found'},404);
      const appMetadata={...(before.user.app_metadata||{}),role};
      const {data:after,error}=await admin.auth.admin.updateUserById(target,{app_metadata:appMetadata}); if(error) throw error;
      await audit(admin,user.id,'user_role','users',target,{role:roleOf(before.user)},{role},{});
      return json({ok:true,user:after.user});
    }

    if (action === 'user_ban') {
      const target=String(body.id||''); const banned=Boolean(body.banned);
      if(target===user.id && banned) return json({error:'You cannot ban your own administrator account'},400);
      const {data:before}=await admin.auth.admin.getUserById(target); if(!before?.user) return json({error:'User not found'},404);
      const {data:after,error}=await admin.auth.admin.updateUserById(target,{ban_duration:banned?'87600h':'none'}); if(error) throw error;
      await audit(admin,user.id,banned?'user_ban':'user_unban','users',target,{banned_until:before.user.banned_until},{banned_until:after.user?.banned_until});
      return json({ok:true,user:after.user});
    }

    if (action === 'delete_user') {
      const target=String(body.id||'');
      if(target===user.id) return json({error:'You cannot delete your own administrator account'},400);
      const {data:before}=await admin.auth.admin.getUserById(target); if(!before?.user) return json({error:'User not found'},404);
      const {error}=await admin.auth.admin.deleteUser(target); if(error) throw error;
      await audit(admin,user.id,'delete_user','users',target,{email:before.user.email,role:roleOf(before.user)},null);
      return json({ok:true});
    }

    return json({ error:'Unsupported admin action' },400);
  } catch (error) {
    return json({ error:error instanceof Error ? error.message : 'Admin operation failed' },500);
  }
});
