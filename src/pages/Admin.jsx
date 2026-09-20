import { invokeFunction } from '../lib/functions';
import { notify } from '../lib/notify';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, Ban, BellRing, Bot, Building2, CheckCircle2, Crown,
  Database, DollarSign, FileText, GraduationCap, Loader2, Pencil, Plus, RefreshCw,
  Save, Search, Settings2, ShieldCheck, Trash2, UserCheck, Users, X
} from 'lucide-react';
import {useAuth} from '../context/session';

const RESOURCE_GROUPS = [
  {
    label: 'Core',
    items: [
      { key:'overview', label:'Overview', icon:Activity },
      { key:'users', label:'Users & Roles', icon:Users },
      { key:'opportunities', label:'Opportunities', icon:GraduationCap },
      { key:'programs', label:'Degree Programs', icon:Database },
      { key:'user_profiles', label:'Student Profiles', icon:Users },
      { key:'user_settings', label:'User Settings', icon:Settings2 },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { key:'subscriptions', label:'Subscriptions', icon:DollarSign },
      { key:'plans', label:'Plans', icon:Crown },
      { key:'sponsors', label:'Sponsors', icon:Building2 },
      { key:'campaigns', label:'Campaigns', icon:Building2 },
      { key:'leads', label:'Campaign Leads', icon:UserCheck },
      { key:'referrals', label:'Program Referrals', icon:UserCheck },
      { key:'lead_consents', label:'Lead Consents', icon:ShieldCheck },
    ],
  },
  {
    label: 'Counselor',
    items: [
      { key:'organizations', label:'Organizations', icon:Building2 },
      { key:'org_members', label:'Org Members', icon:Users },
      { key:'counselor_students', label:'Counselor Students', icon:Users },
      { key:'tasks', label:'Counselor Tasks', icon:CheckCircle2 },
    ],
  },
  {
    label: 'Student data',
    items: [
      { key:'applications', label:'Applications', icon:FileText },
      { key:'watchlists', label:'Watchlists', icon:BellRing },
      { key:'match_scores', label:'Match Scores', icon:Activity },
      { key:'notifications', label:'Notifications', icon:BellRing },
    ],
  },
  {
    label: 'AI & Operations',
    items: [
      { key:'ai_usage', label:'AI Usage', icon:Bot },
      { key:'ai_generations', label:'AI Generations', icon:Bot },
      { key:'agent_runs', label:'Agent Runs', icon:Activity },
      { key:'agent_events', label:'Agent Events', icon:AlertTriangle },
      { key:'reviews', label:'Review Queue', icon:ShieldCheck },
      { key:'opportunity_sources', label:'Source Provenance', icon:Database },
      { key:'opportunity_verifications', label:'Verifications', icon:ShieldCheck },
      { key:'opportunity_versions', label:'Opportunity Versions', icon:Database },
      { key:'analytics', label:'Analytics Events', icon:Activity },
    ],
  },
  {
    label: 'Content & System',
    items: [
      { key:'blog_posts', label:'Blog Posts', icon:FileText },
      { key:'opportunity_blogs', label:'Opportunity Articles', icon:FileText },
      { key:'comments', label:'Comments', icon:FileText },
      { key:'reactions', label:'Likes', icon:Activity },
      { key:'social_publications', label:'Social Publications', icon:FileText },
      { key:'settings', label:'Platform Settings', icon:Settings2 },
      { key:'audit', label:'Admin Audit Log', icon:ShieldCheck },
    ],
  },
];

const LABELS = Object.fromEntries(RESOURCE_GROUPS.flatMap(g => g.items.map(i => [i.key, i.label])));
const COLUMNS = {
  opportunities:['title','organization','country','deadline','verified','verification_confidence'],
  programs:['institution','title','country','level','verified','referral_enabled'],
  user_profiles:['profile_name','full_name','contact_email','citizenship','desired_degree','updated_at'],
  user_settings:['user_id','alert_frequency','timezone','currency','email_alerts_enabled','updated_at'],
  opportunity_sources:['opportunity_id','source_domain','source_type','is_official','http_status','last_checked_at'],
  opportunity_verifications:['opportunity_id','status','confidence','verifier','verified_at'],
  opportunity_versions:['opportunity_id','content_hash','changed_fields','created_at'],
  subscriptions:['user_id','plan_id','status','current_period_end'], plans:['id','name','audience','monthly_ai_credits','max_watchlists','active'],
  sponsors:['organization_name','website','verified','owner_user_id'], campaigns:['title','status','budget_cents','starts_at','ends_at'],
  leads:['campaign_id','user_id','match_score','status'], referrals:['user_id','program_id','status','created_at'], lead_consents:['user_id','campaign_id','shared_fields','consented_at','revoked_at'],
  organizations:['name','type','website','owner_user_id'], org_members:['organization_id','user_id','role','created_at'],
  counselor_students:['display_name','student_email','status','consented_at'], tasks:['title','status','priority','due_at'],
  applications:['user_id','opportunity_id','status','last_activity_at'], watchlists:['user_id','opportunity_id','notify_changes','notify_deadline'],
  match_scores:['user_id','opportunity_id','eligible','score','calculated_at'], notifications:['channel','notification_type','status','sent_at'],
  ai_usage:['user_id','action','provider','model','credit_cost','created_at'], ai_generations:['user_id','action','title','provider','created_at'],
  agent_runs:['agent_name','status','started_at','finished_at','error'], agent_events:['agent_name','level','message','created_at'],
  reviews:['search_title','verification_score','status','source_url','created_at'], analytics:['event_name','entity_type','entity_id','created_at'],
  blog_posts:['title','slug','read_time','created_at'], opportunity_blogs:['title','opportunity_id','read_time','created_at'], comments:['content_type','content_id','author_name','body','status','created_at'], reactions:['content_type','content_id','user_id','created_at'], social_publications:['opportunity_id','channel','external_id','published_at'],
  settings:['key','description','updated_at'], audit:['action','resource','resource_id','actor_user_id','created_at'],
};
const BOOLEAN_FIELDS = new Set(['verified','sponsored','active','referral_enabled','cancel_at_period_end','notify_changes','notify_deadline','eligible','email_alerts_enabled','line_alerts_enabled','in_app_alerts_enabled','notify_new_matches','notify_watchlist_changes','notify_deadline_reminders','notify_application_updates','notify_sponsor_matches','notify_counselor_tasks','notify_referral_updates','notify_product_news','urgent_change_alerts','is_official']);
const NUMBER_FIELDS = new Set(['price_amount','verification_confidence','monthly_ai_credits','max_watchlists','budget_cents','match_score','score','eligibility_score','relevance_score','competitiveness_score','tuition_amount','http_status','confidence','gpa','gpa_scale','budget_amount']);
const ARRAY_FIELDS = new Set(['tags','target_countries','target_fields','target_levels','shared_fields','research_interests','technical_skills','desired_countries','alert_countries_v2','alert_levels_v2','alert_fields_v2','evidence','changed_fields']);
const JSON_FIELDS = new Set(['requirements','eligibility','application_requirements','features','lead_data','checklist','matched_rules','warnings','structured_output','metrics','metadata','value','scholarships','education','experience','publications','projects','awards','certifications','languages','english_test','snapshot','checks']);
const LONG_FIELDS = new Set(['description','content','excerpt','funding_details','partner_disclosure','review_note','explanation','notes']);

function formatValue(value, key='') {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'budget_cents') return `$${(Number(value || 0) / 100).toFixed(2)}`;
  if (typeof value === 'object') {
    const text = JSON.stringify(value);
    return text.length > 72 ? `${text.slice(0, 69)}…` : text;
  }
  const text = String(value);
  if (/(_at|created_at|updated_at|sent_at|started_at|finished_at|consented_at|due_at|current_period_end)$/.test(key) && !Number.isNaN(Date.parse(text))) return new Date(text).toLocaleString();
  return text.length > 72 ? `${text.slice(0, 69)}…` : text;
}

function rowIdentity(resource,row) {
  if (resource === 'org_members') return row?._admin_id || { organization_id:row?.organization_id, user_id:row?.user_id };
  return row?.id ?? row?.key;
}
function rowKey(resource,row) {
  const id=rowIdentity(resource,row);
  return typeof id === 'object' ? JSON.stringify(id) : String(id ?? 'row');
}

async function adminInvoke(body) {
  const { data, error } = await invokeResult('admin-api', { body });
  if (error || data?.error) throw new Error(data?.error || error.message);
  return data;
}

export default function Admin() {
  const [active, setActive] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [editable, setEditable] = useState([]);
  const [creatable, setCreatable] = useState(false);
  const [deletable, setDeletable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState('');

  const load = async (resource=active) => {
    setLoading(true); setError('');
    try {
      if (resource === 'overview') {
        setOverview(await adminInvoke({ action:'overview' }));
      } else if (resource === 'users') {
        const data = await adminInvoke({ action:'list_users', page, limit:50, search });
        setRows(data.rows || []); setCount(data.count || 0); setEditable([]); setCreatable(false); setDeletable(true);
      } else {
        const data = await adminInvoke({ action:'list', resource, page, limit:50, search });
        setRows(data.rows || []); setCount(data.count || 0); setEditable(data.editable || []); setCreatable(Boolean(data.creatable)); setDeletable(Boolean(data.deletable));
      }
    } catch (e) { setError(e.message || 'Admin request failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setPage(1); setSearch(''); }, [active]);
  useEffect(() => { const timer=setTimeout(()=>load(active), search ? 300 : 0); return()=>clearTimeout(timer); }, [active,page,search]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutate = async (payload, busyId='action') => {
    setBusy(busyId);
    try { await adminInvoke(payload); setEditor(null); await load(active); }
    catch (e) { notify(e.message || 'Admin action failed'); }
    finally { setBusy(''); }
  };

  const deleteRow = (row) => {
    if (!window.confirm(`Delete this ${LABELS[active]?.toLowerCase() || 'record'}? This cannot be undone.`)) return;
    const id=rowIdentity(active,row); mutate({ action:'delete', resource:active, id }, `delete-${rowKey(active,row)}`);
  };

  return (
    <div className="admin-shell space-y-5 pb-12">
      <header className="rounded-3xl border border-indigo-200/70 dark:border-indigo-500/20 bg-gradient-to-br from-white via-indigo-50/60 to-cyan-50/40 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold uppercase tracking-wider"><ShieldCheck className="w-4 h-4"/>Administrator control plane</div>
            <h1 className="mt-3 text-2xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">Manage ScholarPortal end to end</h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-3xl">Users, content, revenue, counselors, sponsors, AI operations, alerts, platform settings and audit history are controlled through server-side administrator actions.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link to="/quality" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-sm font-bold"><ShieldCheck className="w-4 h-4 text-emerald-500"/>Trust & Quality</Link>
            <button onClick={()=>load(active)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>Refresh</button>
          </div>
        </div>
      </header>

      <div className="grid xl:grid-cols-[240px_minmax(0,1fr)] gap-5 items-start">
        <aside className="xl:sticky xl:top-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-sm overflow-hidden">
          <div className="xl:block flex gap-2 overflow-x-auto admin-scroll pb-1 xl:pb-0">
            {RESOURCE_GROUPS.map(group => (
              <div key={group.label} className="xl:mb-4 shrink-0">
                <p className="hidden xl:block px-3 py-2 text-[11px] uppercase tracking-[0.16em] font-black text-slate-400">{group.label}</p>
                <div className="flex xl:block gap-1">
                  {group.items.map(item => {
                    const Icon=item.icon; const selected=active===item.key;
                    return <button key={item.key} onClick={()=>setActive(item.key)} className={`w-auto xl:w-full whitespace-nowrap flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition ${selected?'bg-indigo-600 text-white shadow-md shadow-indigo-600/20':'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon className="w-4 h-4 shrink-0"/>{item.label}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          {error ? <ErrorState error={error} retry={()=>load(active)}/> : loading ? <LoadingState/> : active === 'overview' ? <Overview data={overview} busy={busy} mutate={mutate}/> : active === 'users' ? <UsersPanel rows={rows} busy={busy} mutate={mutate} search={search} setSearch={setSearch} page={page} setPage={setPage} count={count}/> : <ResourcePanel resource={active} rows={rows} count={count} editable={editable} creatable={creatable} deletable={deletable} search={search} setSearch={setSearch} page={page} setPage={setPage} setEditor={setEditor} deleteRow={deleteRow} busy={busy}/>}
        </section>
      </div>

      {editor?.readonly ? <div className="fixed inset-0 z-[80] bg-slate-950/60 p-6 grid place-items-center"><div role="dialog" aria-label="Record details" className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto"><button className="admin-action mb-4" onClick={()=>setEditor(null)}>Close details</button><pre>{JSON.stringify(editor.row,null,2)}</pre></div></div> : editor && <Editor resource={active} row={editor.row} fields={editable} creating={editor.creating} busy={busy} onClose={()=>setEditor(null)} onSave={(values)=>mutate({ action:editor.creating?'create':'update', resource:active, id:rowIdentity(active,editor.row), values }, 'save-editor')}/>}
    </div>
  );
}

function Overview({data,busy,mutate}) {
  const m=data?.metrics || {};
  const cards=[
    ['Users',m.users,Users,'All registered accounts'], ['Verified opportunities',m.verifiedOpportunities,ShieldCheck,`${m.opportunities ?? 0} total opportunities`],
    ['Applications',m.applications,FileText,'Student application records'], ['Active subscriptions',m.activeSubscriptions,Crown,`${m.subscriptions ?? 0} subscription records`],
    ['Sponsors',m.sponsors,Building2,`${m.campaigns ?? 0} campaigns`], ['Campaign leads',m.leads,UserCheck,'Consented sponsor leads'],
    ['Counselor students',m.counselorStudents,Users,'Managed student relationships'], ['Pending review',m.pendingReviews,AlertTriangle,`${m.pendingReferrals ?? 0} referral requests`],
    ['AI usage events',m.aiUsage,Bot,'Metered AI activity'], ['Notifications',m.notifications,BellRing,'Delivery records'],
  ];
  return <div className="space-y-5">
    <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">{cards.map(([label,value,Icon,sub])=><div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm min-w-0"><div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-300 grid place-items-center"><Icon className="w-4 h-4"/></div><div className="mt-3 text-2xl sm:text-3xl font-black text-slate-950 dark:text-white">{value ?? '—'}</div><div className="mt-1 text-sm font-extrabold text-slate-800 dark:text-slate-100">{label}</div><div className="mt-1 text-xs text-slate-500 truncate">{sub}</div></div>)}</div>
    <Card title="Operational controls"><div className="flex flex-wrap gap-2"><button disabled={busy==='workflow-agents'} onClick={()=>mutate({action:'trigger_workflow',workflow:'agents'},'workflow-agents')} className="admin-action"><Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-300"/>Run agent pipeline</button><button disabled={busy==='workflow-sitemap'} onClick={()=>mutate({action:'trigger_workflow',workflow:'sitemap'},'workflow-sitemap')} className="admin-action"><RefreshCw className="w-4 h-4 text-cyan-700 dark:text-cyan-300"/>Refresh sitemap</button></div><p className="mt-3 text-xs text-slate-500">Manual runs use GitHub Actions and require GITHUB_ACTIONS_TOKEN + GITHUB_REPOSITORY on the admin Edge Function.</p></Card>
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Account roles"><div className="grid grid-cols-3 gap-2">{Object.entries(m.roles || {}).map(([role,total])=><div key={role} className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3"><div className="text-xl font-black">{total}</div><div className="text-xs text-slate-500 capitalize">{role}</div></div>)}</div></Card>
      <Card title="Active plan mix"><div className="space-y-2">{Object.entries(m.planMix || {}).length ? Object.entries(m.planMix).map(([plan,total])=><div key={plan} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-2"><span className="font-bold capitalize">{plan}</span><span className="px-2 py-0.5 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-300 font-black text-sm">{total}</span></div>) : <Empty text="No active paid plans yet."/>}</div></Card>
      <Card title="Operations health"><div className="space-y-2">{(data?.recentRuns || []).slice(0,6).map(run=><div key={run.id} className="flex gap-3 items-start rounded-xl bg-slate-50 dark:bg-slate-950 p-3"><span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${run.status==='success'?'bg-emerald-500':run.status==='running'?'bg-amber-500':'bg-rose-500'}`}/><div className="min-w-0"><div className="font-bold text-sm truncate">{run.agent_name}</div><div className="text-xs text-slate-500">{formatValue(run.started_at,'started_at')} · {run.status}</div></div></div>)}</div></Card>
    </div>
    <Card title="Recent administrator changes"><div className="divide-y divide-slate-100 dark:divide-slate-800">{(data?.recentAudit || []).length ? data.recentAudit.map(log=><div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><div className="text-sm"><strong>{log.action}</strong> <span className="text-slate-500">{log.resource}{log.resource_id?` · ${String(log.resource_id).slice(0,10)}`:''}</span></div><span className="text-xs text-slate-500">{formatValue(log.created_at,'created_at')}</span></div>) : <Empty text="No administrator changes recorded yet."/>}</div></Card>
  </div>;
}

function UsersPanel({rows,busy,mutate,search,setSearch,page,setPage,count}) {
  const {user}=useAuth();
  const createUser=()=>{const email=window.prompt('New user email');if(!email)return;const password=window.prompt('Temporary password (minimum 8 characters)');if(!password)return;const role=(window.prompt('Role: user, staff, or admin','user')||'user').toLowerCase();mutate({action:'create_user',email,password,role},'create-user')};
  return <Panel title="Users & Roles" subtitle="Promote staff/admins, suspend accounts, inspect plan status, or remove an account. Auth changes are written to the admin audit log." actions={<button onClick={createUser} disabled={busy==='create-user'} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold"><Plus className="w-4 h-4"/>Create user</button>}>
    <div className="flex flex-wrap gap-3 mb-4"><input aria-label="Search users" placeholder="Search by email or user ID" className="admin-input flex-1" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></div><div className="space-y-3">
      {rows.length===0?<Empty text="No users found."/>:rows.map(u=>{
        const banned = Boolean(u.banned_until && new Date(u.banned_until) > new Date());
        return <div key={u.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex flex-col xl:flex-row xl:items-center gap-4">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-950 dark:text-white truncate">{u.email || u.phone || u.id}</p><span className={`px-2 py-0.5 rounded-lg text-[11px] font-black uppercase ${u.role==='admin'?'bg-violet-500/10 text-violet-700 dark:text-violet-300':u.role==='staff'?'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{u.role}</span>{banned&&<span className="px-2 py-0.5 rounded-lg text-[11px] font-black uppercase bg-rose-500/10 text-rose-600 dark:text-rose-300">Suspended</span>}</div><p className="mt-1 text-xs text-slate-500 break-all">{u.id}</p><p className="mt-1 text-xs text-slate-500">Joined {formatValue(u.created_at,'created_at')} · Last sign-in {formatValue(u.last_sign_in_at,'last_sign_in_at')} · Plan {u.subscription?.plan_id || 'free'}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={u.role} onChange={e=>mutate({action:'user_role',id:u.id,role:e.target.value},`role-${u.id}`)} disabled={u.id===user?.id||busy===`role-${u.id}`} className="admin-input py-2 text-sm"><option value="user">User</option><option value="staff">Staff</option><option value="admin">Admin</option></select>
              <button onClick={()=>mutate({action:'user_ban',id:u.id,banned:!banned},`ban-${u.id}`)} disabled={u.id===user?.id||busy===`ban-${u.id}`} className={`admin-action ${banned?'text-emerald-700 dark:text-emerald-300':'text-amber-700 dark:text-amber-300'}`}>{banned?<UserCheck className="w-4 h-4"/>:<Ban className="w-4 h-4"/>}{banned?'Unsuspend':'Suspend'}</button>
              <button onClick={()=>{if(window.confirm(`Permanently delete ${u.email || u.id}?`))mutate({action:'delete_user',id:u.id},`delete-user-${u.id}`)}} disabled={u.id===user?.id||busy===`delete-user-${u.id}`} className="admin-action text-rose-600 dark:text-rose-300"><Trash2 className="w-4 h-4"/>Delete</button>
            </div>
          </div>
        </div>;
      })}
    </div><div className="flex justify-between mt-4"><button className="admin-action" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(count/50))}</span><button className="admin-action" disabled={page*50>=count} onClick={()=>setPage(page+1)}>Next</button></div>
  </Panel>;
}

function ResourcePanel({resource,rows,count,editable,creatable,deletable,search,setSearch,page,setPage,setEditor,deleteRow,busy}) {
  const cols = COLUMNS[resource] || Object.keys(rows[0] || {}).slice(0,6);
  const pages = Math.max(1, Math.ceil(count / 50));
  return <Panel title={LABELS[resource] || resource} subtitle={`${count.toLocaleString()} record${count===1?'':'s'} · privileged changes are performed server-side and audited.`} actions={creatable?<button onClick={()=>setEditor({creating:true,row:{}})} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold"><Plus className="w-4 h-4"/>Add</button>:null}>
    <div className="flex flex-col sm:flex-row gap-2 mb-4"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${LABELS[resource]?.toLowerCase() || 'records'}…`} className="admin-input w-full pl-9"/></div><div className="text-xs text-slate-500 self-center">Page {page} of {pages}</div></div>
    {rows.length===0?<Empty text="No records found."/>:<>
      <div className="hidden md:block overflow-x-auto admin-scroll rounded-xl border border-slate-200 dark:border-slate-800"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 dark:bg-slate-950 text-left"><tr>{cols.map(c=><th key={c} className="px-3 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-black">{c.replaceAll('_',' ')}</th>)}<th className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-slate-500 font-black">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map(row=><tr key={rowKey(resource,row)} className="bg-white dark:bg-slate-900 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5">{cols.map(c=><td key={c} className="px-3 py-3 max-w-[260px] truncate" title={typeof row[c]==='string'?row[c]:undefined}>{formatValue(row[c],c)}</td>)}<td className="px-3 py-3"><div className="flex justify-end gap-1"><button onClick={()=>setEditor({creating:false,row,readonly:!editable.length})} className="admin-icon" title={editable.length?"Edit":"View details"}><Pencil className="w-4 h-4"/></button>{deletable&&<button disabled={busy===`delete-${rowKey(resource,row)}`} onClick={()=>deleteRow(row)} className="admin-icon text-rose-600 dark:text-rose-300" title="Delete"><Trash2 className="w-4 h-4"/></button>}</div></td></tr>)}</tbody></table></div>
      <div className="md:hidden space-y-3">{rows.map(row=><div key={rowKey(resource,row)} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><div className="space-y-2">{cols.slice(0,5).map(c=><div key={c} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3"><span className="text-[11px] uppercase tracking-wide font-black text-slate-400">{c.replaceAll('_',' ')}</span><span className="text-sm break-words min-w-0">{formatValue(row[c],c)}</span></div>)}</div><div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800"><button onClick={()=>setEditor({creating:false,row,readonly:!editable.length})} className="admin-action"><Pencil className="w-4 h-4"/>{editable.length?"Edit":"View details"}</button>{deletable&&<button onClick={()=>deleteRow(row)} className="admin-action text-rose-600 dark:text-rose-300"><Trash2 className="w-4 h-4"/>Delete</button>}</div></div>)}</div>
      <div className="flex items-center justify-between mt-4"><button disabled={page<=1} onClick={()=>setPage(Math.max(1,page-1))} className="admin-action disabled:opacity-40">Previous</button><button disabled={page>=pages} onClick={()=>setPage(Math.min(pages,page+1))} className="admin-action disabled:opacity-40">Next</button></div>
    </>}
  </Panel>;
}

function Editor({resource,row,fields,creating,busy,onClose,onSave}) {
  const initial=useMemo(()=>Object.fromEntries(fields.map(f=>[f,row?.[f] ?? (BOOLEAN_FIELDS.has(f)?false:ARRAY_FIELDS.has(f)?[]:JSON_FIELDS.has(f)?{}:'')])),[fields,row]);
  const [values,setValues]=useState(initial); const [formError,setFormError]=useState('');
  const submit=(e)=>{e.preventDefault();setFormError('');try{const parsed={};for(const f of fields){const v=values[f];if(JSON_FIELDS.has(f)&&typeof v==='string') parsed[f]=v.trim()?JSON.parse(v):{};else if(ARRAY_FIELDS.has(f)&&typeof v==='string') parsed[f]=v.split(',').map(x=>x.trim()).filter(Boolean);else if(NUMBER_FIELDS.has(f)) parsed[f]=v===''?null:Number(v);else parsed[f]=v;}onSave(parsed);}catch(err){setFormError(`Invalid JSON: ${err.message}`)}};
  return <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6 grid place-items-center" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><form onSubmit={submit} className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col"><div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">{creating?'Add':'Edit'} {LABELS[resource]}</h2><p className="text-xs text-slate-500 mt-1">Only whitelisted fields can be changed by this control.</p></div><button type="button" onClick={onClose} className="admin-icon"><X className="w-5 h-5"/></button></div><div className="p-4 sm:p-5 overflow-y-auto admin-scroll grid sm:grid-cols-2 gap-4">{fields.map(field=><Field key={field} name={field} value={values[field]} setValue={v=>setValues(prev=>({...prev,[field]:v}))}/>)}</div>{formError&&<p className="mx-5 mb-2 text-sm text-rose-600">{formError}</p>}<div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2"><button type="button" onClick={onClose} className="admin-action">Cancel</button><button disabled={busy==='save-editor'} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-60">{busy==='save-editor'?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{creating?'Create':'Save changes'}</button></div></form></div>;
}

function Field({name,value,setValue}) {
  const label=name.replaceAll('_',' ');
  if(name==='value'&&value&&typeof value==='object'&&!Array.isArray(value))return <fieldset className="sm:col-span-2 space-y-3"><legend className="font-bold mb-2">Controls</legend>{Object.entries(value).map(([key,v])=><label key={key} className="flex justify-between gap-4 items-center"><span>{key.replaceAll('_',' ')}</span>{typeof v==='boolean'?<input aria-label={key} type="checkbox" role="switch" checked={v} onChange={e=>setValue({...value,[key]:e.target.checked})}/>:<input className="admin-input" aria-label={key} type={typeof v==='number'?'number':'text'} value={typeof v==='object'?JSON.stringify(v):v??''} onChange={e=>{let next=e.target.value;if(typeof v==='number')next=Number(next);if(typeof v==='object'){try{next=JSON.parse(next);}catch{return;}}setValue({...value,[key]:next});}}/>}</label>)}</fieldset>;
  if(BOOLEAN_FIELDS.has(name)) return <label className="sm:col-span-1 flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3"><span className="text-sm font-bold capitalize">{label}</span><input type="checkbox" checked={Boolean(value)} onChange={e=>setValue(e.target.checked)} className="w-5 h-5 accent-indigo-600"/></label>;
  const isJson=JSON_FIELDS.has(name); const isArray=ARRAY_FIELDS.has(name); const long=LONG_FIELDS.has(name)||isJson;
  const shown=isJson&&typeof value!=='string'?JSON.stringify(value,null,2):isArray&&Array.isArray(value)?value.join(', '):(value ?? '');
  return <label className={`${long?'sm:col-span-2':''} min-w-0`}><span className="block mb-1.5 text-xs uppercase tracking-wide font-black text-slate-500">{label}</span>{long?<textarea rows={isJson?6:4} value={shown} onChange={e=>setValue(e.target.value)} className="admin-input w-full font-normal" placeholder={isJson?'Valid JSON':''}/>:<input type={NUMBER_FIELDS.has(name)?'number':'text'} value={shown} onChange={e=>setValue(e.target.value)} className="admin-input w-full"/>}{isArray&&<span className="block mt-1 text-[11px] text-slate-400">Comma-separated values</span>}</label>;
}

function Panel({title,subtitle,actions,children}) { return <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm overflow-hidden"><div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">{title}</h2><p className="mt-1 text-sm text-slate-500 max-w-3xl">{subtitle}</p></div>{actions}</div><div className="p-3 sm:p-5">{children}</div></div>; }
function Card({title,children}) { return <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm"><h3 className="font-black text-slate-950 dark:text-white mb-3">{title}</h3>{children}</div>; }
function Empty({text}) { return <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">{text}</div>; }
function LoadingState(){return <div className="h-[52vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid place-items-center"><div className="text-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto"/><p className="mt-3 text-sm text-slate-500">Loading admin data…</p></div></div>}
function ErrorState({error,retry}){return <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6"><AlertTriangle className="w-8 h-8 text-rose-500"/><h2 className="mt-3 text-xl font-black">Admin panel unavailable</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error}</p><button onClick={retry} className="mt-4 admin-action"><RefreshCw className="w-4 h-4"/>Retry</button></div>}

async function invokeResult(name,options){try{return {data:await invokeFunction(name,options),error:null};}catch(error){return {data:null,error};}}
