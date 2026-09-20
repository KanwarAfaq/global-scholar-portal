import {useEffectEvent} from 'react';
import React, { useEffect, useState } from 'react';
import { Activity, BellRing, Bot, Calendar, Loader2, Target, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {useAuth} from '../context/session';
import {supabase} from '../context/../lib/supabase';

const statusLabels = { 'col-1':'Saved', 'col-2':'Preparing', 'col-3':'Applied', 'col-4':'Interview', 'col-5':'Offer' };
const statusColors = { 'col-1':'#94a3b8', 'col-2':'#f59e0b', 'col-3':'#3b82f6', 'col-4':'#a855f7', 'col-5':'#10b981' };

function Metric({ icon:Icon,label,value,detail }) { return <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800"><div className="flex gap-3 items-center"><div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500"><Icon className="w-5 h-5"/></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p></div></div>{detail&&<p className="text-xs text-slate-500 mt-3">{detail}</p>}</div> }

export default function Analytics() {
  const { user } = useAuth();
  const [loading,setLoading] = useState(true);
  const [stats,setStats] = useState({ total:0, active:0, offerRate:0, interviewRate:0, avgMatch:null, watchlists:0, aiCredits:0, generations:0, funnel:[], deadlines:[] });

  const effectLoad=useEffectEvent(()=>load());
  useEffect(()=>{ if(user) effectLoad(); },[user]);
  async function load(){
    setLoading(true);
    const month = new Date(); month.setUTCDate(1); month.setUTCHours(0,0,0,0);
    const [{data:apps,error},{data:matches},{data:watches},{data:usage},{data:gens}] = await Promise.all([
      supabase.from('user_applications').select('id,status,global_opportunities(title,organization,deadline)').eq('user_id',user.id),
      supabase.from('user_match_scores').select('score,eligible').eq('user_id',user.id),
      supabase.from('user_watchlists').select('id').eq('user_id',user.id),
      supabase.from('ai_usage').select('credit_cost,success').eq('user_id',user.id).gte('created_at',month.toISOString()),
      supabase.from('ai_generations').select('id').eq('user_id',user.id).gte('created_at',month.toISOString())
    ]);
    if(error) console.error(error);
    const rows=apps||[]; const total=rows.length; const status={}; rows.forEach(a=>status[a.status]=(status[a.status]||0)+1);
    const applied=(status['col-3']||0)+(status['col-4']||0)+(status['col-5']||0); const interviews=(status['col-4']||0)+(status['col-5']||0); const offers=status['col-5']||0;
    const avgMatch=matches?.length?Math.round(matches.reduce((a,x)=>a+Number(x.score||0),0)/matches.length):null;
    const deadlines=rows.filter(a=>a.global_opportunities?.deadline && /^\d{4}-\d{2}-\d{2}$/.test(a.global_opportunities.deadline) && !['col-5'].includes(a.status)).map(a=>({...a.global_opportunities,id:a.id,date:new Date(`${a.global_opportunities.deadline}T12:00:00`)})).filter(x=>x.date>=new Date()).sort((a,b)=>a.date-b.date).slice(0,8);
    setStats({
      total, active:(status['col-2']||0)+(status['col-3']||0)+(status['col-4']||0), offerRate:applied?Math.round(offers/applied*100):0,
      interviewRate:applied?Math.round(interviews/applied*100):0, avgMatch, watchlists:(watches||[]).length,
      aiCredits:(usage||[]).filter(x=>x.success!==false).reduce((a,x)=>a+Number(x.credit_cost||0),0), generations:(gens||[]).length,
      funnel:Object.keys(statusLabels).map(k=>({name:statusLabels[k],value:status[k]||0,color:statusColors[k]})), deadlines
    }); setLoading(false);
  }

  if(loading) return <div className="h-[60vh] grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div>;
  return <div className="max-w-7xl mx-auto space-y-7 pb-12">
    <div><h1 className="text-3xl font-black text-slate-900 dark:text-white">Outcome Analytics</h1><p className="text-slate-500 mt-1">Measure the full application funnel, match quality, monitoring usage and AI workload.</p></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"><Metric icon={Target} label="Tracked" value={stats.total} detail={`${stats.active} applications currently active`}/><Metric icon={TrendingUp} label="Interview rate" value={`${stats.interviewRate}%`} detail="Interviews or offers divided by submitted applications"/><Metric icon={Activity} label="Offer rate" value={`${stats.offerRate}%`} detail="Offers divided by submitted applications"/><Metric icon={Target} label="Average match" value={stats.avgMatch===null?'—':`${stats.avgMatch}%`} detail="Across explainable matches you have calculated"/></div>
    <div className="grid sm:grid-cols-3 gap-4"><Metric icon={BellRing} label="Watchlists" value={stats.watchlists} detail="Opportunities monitored for changes/deadlines"/><Metric icon={Bot} label="AI credits this month" value={stats.aiCredits} detail={`${stats.generations} saved AI generations`}/><Metric icon={Calendar} label="Upcoming deadlines" value={stats.deadlines.length} detail="Nearest tracked deadlines shown below"/></div>
    <div className="grid lg:grid-cols-3 gap-5"><section className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800"><h2 className="font-extrabold mb-5">Application funnel</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.funnel}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15}/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis allowDecimals={false} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="value" radius={[8,8,0,0]}>{stats.funnel.map((x,i)=><Cell key={i} fill={x.color}/>)}</Bar></BarChart></ResponsiveContainer></div></section><section className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800"><h2 className="font-extrabold mb-4 flex gap-2"><Calendar className="w-5 h-5 text-orange-500"/>Deadline risk</h2><div className="space-y-3">{stats.deadlines.length===0?<p className="text-sm text-slate-500">No upcoming tracked deadlines.</p>:stats.deadlines.map(x=>{const days=Math.ceil((x.date-new Date())/86400000);return <div key={x.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950"><p className={`text-xs font-bold ${days<=7?'text-rose-500':'text-orange-500'}`}>{days} day{days===1?'':'s'} left · {x.deadline}</p><p className="font-bold text-sm mt-1 line-clamp-2">{x.title}</p><p className="text-xs text-slate-500">{x.organization}</p></div>})}</div></section></div>
    <p className="text-xs text-slate-500">Rates are directional productivity metrics, not predictions or guarantees. Outcomes improve in usefulness as you consistently update application status.</p>
  </div>;
}
