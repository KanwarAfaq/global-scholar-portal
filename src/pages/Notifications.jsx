import {notify} from '../lib/notify';
import {useEffectEvent} from 'react';
import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCheck, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import {useAuth} from '../context/session';
import {supabase} from '../context/../lib/supabase';

const titleFor = row => {
  const meta = row.metadata || {};
  if (row.notification_type === 'opportunity_change') return `Opportunity updated: ${meta.title || row.global_opportunities?.title || 'Watched opportunity'}`;
  if (row.notification_type === 'deadline_reminder') return `Deadline reminder: ${meta.title || row.global_opportunities?.title || 'Watched opportunity'}`;
  if (row.notification_type === 'match_digest') return 'Verified opportunity digest sent';
  return String(row.notification_type || 'Notification').replaceAll('_', ' ');
};

const detailFor = row => {
  const meta = row.metadata || {};
  if (row.notification_type === 'opportunity_change') {
    const fields = meta.changed_fields || [];
    return fields.length ? `Changed fields: ${fields.join(', ')}` : 'ScholarPortal detected a change on the official source page.';
  }
  if (row.notification_type === 'deadline_reminder') {
    const days = meta.days_left;
    return days === 0 ? 'The application deadline is today.' : `${days} day${days === 1 ? '' : 's'} remaining before the recorded deadline.`;
  }
  if (row.notification_type === 'application_completeness') return (meta.assessment?.missing_items||[]).map(x=>typeof x==='string'?x:x.title).join(' · ') || 'Review saved application evidence.';
  if (row.notification_type === 'match_digest') return `Delivery channel: ${row.channel}.`;
  return 'ScholarPortal notification.';
};

export default function Notifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);setLoadError('');
    const { data, error } = await supabase
      .from('notification_deliveries')
      .select('id,channel,notification_type,status,sent_at,read_at,metadata,opportunity_id,global_opportunities(id,title,organization,official_source_url,url)')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(100);
    if (error) setLoadError('Unable to load notifications. Please retry.');else setRows(data || []);
    setLoading(false);
  };

  const effectLoad=useEffectEvent(()=>load());
  useEffect(() => { effectLoad(); }, [user]);
  const unread = useMemo(() => rows.filter(r => !r.read_at && r.channel === 'in_app').length, [rows]);

  const markRead = async id => {
    const {error}=await supabase.from('notification_deliveries').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
    if(error){notify(error.message);return;}
    setRows(prev => prev.map(r => r.id === id ? { ...r, read_at: new Date().toISOString() } : r));
  };
  const markAllRead = async () => {
    const ids = rows.filter(r => !r.read_at && r.channel === 'in_app').map(r => r.id);
    if (!ids.length) return;
    const {error}=await supabase.from('notification_deliveries').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).eq('channel', 'in_app').is('read_at', null);
    if(error){notify(error.message);return;}
    const stamp = new Date().toISOString();
    setRows(prev => prev.map(r => ids.includes(r.id) ? { ...r, read_at: stamp } : r));
  };

  return <div className="max-w-5xl mx-auto space-y-6 pb-12">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div><h1 className="text-3xl font-black text-slate-900 dark:text-white">Notifications</h1><p className="text-slate-500 mt-1">Watchlist changes, deadline reminders, and delivery history. {unread ? `${unread} unread.` : 'You are caught up.'}</p></div>
      <div className="flex gap-2"><button onClick={load} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Refresh</button><button onClick={markAllRead} disabled={!unread} className="px-3 py-2 rounded-xl bg-indigo-600 disabled:opacity-40 text-white font-bold text-sm flex items-center gap-2"><CheckCheck className="w-4 h-4"/>Mark all read</button></div>
    </div>
    {loadError?<div role="alert" className="p-5 rounded-xl border border-rose-400">{loadError}<button className="admin-action ml-3" onClick={load}>Retry</button></div>:loading ? <div className="h-48 grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-indigo-500"/></div> : rows.length === 0 ? <div className="p-10 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500"><BellRing className="w-8 h-8 mx-auto mb-3"/>No notification deliveries yet.</div> : <div className="space-y-3">{rows.map(row => {
      const opp = row.global_opportunities || {};
      const isUnread = row.channel === 'in_app' && !row.read_at;
      return <article key={row.id} className={`rounded-2xl border p-4 sm:p-5 ${isUnread ? 'border-indigo-400/50 bg-indigo-50/70 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold text-slate-900 dark:text-white">{titleFor(row)}</h2>{isUnread && <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-indigo-600 text-white font-black">Unread</span>}</div><p className="text-sm text-slate-500 mt-1">{detailFor(row)}</p><p className="text-xs text-slate-400 mt-2">{new Date(row.sent_at).toLocaleString()} · {row.channel}</p></div><div className="flex gap-2 shrink-0">{opp && (opp.official_source_url || opp.url) && <a href={opp.official_source_url || opp.url} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800" title="Open official source"><ExternalLink className="w-4 h-4"/></a>}{isUnread && <button onClick={() => markRead(row.id)} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold">Mark read</button>}</div></div>
      </article>;
    })}</div>}
  </div>;
}
