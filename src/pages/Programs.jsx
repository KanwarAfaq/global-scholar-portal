import {activeProfileId,selectProfile} from '../lib/profile';
import { invokeFunction } from '../lib/functions';
import { notify } from '../lib/notify';
import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Handshake, Loader2, Search, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import {useAuth} from '../context/session';
import {supabase} from '../context/../lib/supabase';

const norm = v => String(v || '').trim().toLowerCase();
const includesLoose = (a, b) => norm(a).includes(norm(b)) || norm(b).includes(norm(a));

function programFit(program, profile) {
  if (!profile) return { score: null, reasons: [], blockers: [] };
  let earned = 0, possible = 0;
  const reasons = [], blockers = [];
  const e = program.eligibility || {};

  if ((profile.desired_countries || []).length) {
    possible += 20;
    if (profile.desired_countries.some(c => includesLoose(c, program.country))) { earned += 20; reasons.push('Preferred destination'); }
  }
  if (profile.desired_degree) {
    possible += 20;
    if (includesLoose(profile.desired_degree, program.level)) { earned += 20; reasons.push('Degree level match'); }
  }
  const profileText = JSON.stringify([profile.bio,profile.research_interests,profile.technical_skills,profile.skills]);
  if (profileText && program.field) {
    possible += 20;
    const tokens = norm(program.field).split(/[^a-z0-9]+/).filter(x => x.length > 3);
    if (tokens.some(t => norm(profileText).includes(t))) { earned += 20; reasons.push('Field/background overlap'); }
  }
  if (profile.budget_amount && program.tuition_amount && (!profile.budget_currency || profile.budget_currency === program.tuition_currency)) {
    possible += 20;
    if (Number(program.tuition_amount) <= Number(profile.budget_amount)) { earned += 20; reasons.push('Within stated budget'); }
    else blockers.push('Tuition is above your stated budget before scholarships');
  }
  if (e.min_gpa && profile.gpa) {
    possible += 20;
    const userScale = Number(profile.gpa_scale || 4);
    const minScale = Number(e.gpa_scale || userScale);
    const normalizedUser = userScale ? Number(profile.gpa) / userScale : 0;
    const normalizedMin = minScale ? Number(e.min_gpa) / minScale : 0;
    if (normalizedUser >= normalizedMin) { earned += 20; reasons.push('GPA threshold met'); }
    else blockers.push(`Published GPA threshold may not be met (${e.min_gpa}/${minScale})`);
  }
  if (Array.isArray(e.citizenships) && e.citizenships.length && profile.citizenship) {
    possible += 20;
    if (e.citizenships.some(c => norm(c) === 'all' || includesLoose(c, profile.citizenship))) { earned += 20; reasons.push('Citizenship appears eligible'); }
    else blockers.push('Citizenship does not match the published eligibility list');
  }
  if (Array.isArray(e.language_tests) && e.language_tests.length && profile.english_test?.type && profile.english_test?.score !== '') {
    const rule = e.language_tests.find(r => typeof r === 'object' && includesLoose(r.type, profile.english_test.type));
    if (rule?.min_score != null) {
      possible += 20;
      if (Number(profile.english_test.score) >= Number(rule.min_score)) { earned += 20; reasons.push(`${profile.english_test.type} threshold met`); }
      else blockers.push(`${profile.english_test.type} score is below the published minimum (${rule.min_score})`);
    }
  }
  const score = possible ? Math.round((earned / possible) * 100) : 50;
  return { score: blockers.length ? Math.min(score, 59) : score, reasons, blockers };
}

export default function Programs() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState('');
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('All');
  const [level, setLevel] = useState('All');
  const [maxBudget, setMaxBudget] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('programs').select('*').eq('verified', true).order('created_at', { ascending: false });
      setPrograms(data || []);
      if (user) {
        const { data: p } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
        setProfiles(p || []); if (p?.length) setProfileId(p.find(x=>x.id===activeProfileId(user.id))?.id||p[0].id);
      }
      setLoading(false);
    })();
  }, [user]);

  const selectedProfile = profiles.find(p => p.id === profileId);
  const countries = useMemo(() => ['All', ...new Set(programs.map(p => p.country).filter(Boolean))].sort(), [programs]);
  const levels = useMemo(() => ['All', ...new Set(programs.map(p => p.level).filter(Boolean))].sort(), [programs]);
  const list = useMemo(() => programs.map(p => ({ ...p, fit: programFit(p, selectedProfile) })).filter(p => {
    const text = [p.institution, p.title, p.country, p.level, p.field].join(' ').toLowerCase();
    if (!text.includes(q.toLowerCase())) return false;
    if (country !== 'All' && p.country !== country) return false;
    if (level !== 'All' && p.level !== level) return false;
    if (maxBudget && p.tuition_amount && Number(p.tuition_amount) > Number(maxBudget)) return false;
    return true;
  }).sort((a, b) => (b.fit.score ?? 0) - (a.fit.score ?? 0)), [programs, selectedProfile, q, country, level, maxBudget]);

  const refer = async p => {
    if (!user) { location.href = '/auth'; return; }
    if (!p.referral_enabled) return notify('This program is not currently a referral partner. Apply through the official page.');
    const disclosure = p.partner_disclosure || 'ScholarPortal may receive compensation from this partner if a referral results in enrollment.';
    if (!confirm(`${disclosure}\n\nRequest a referral to ${p.institution}? Only the selected profile fields will be included.`)) return;
    const sharedFields = ['full_name','contact_email','location','citizenship','desired_degree','gpa','gpa_scale','english_test','education','technical_skills','research_interests'];
    const { data, error } = await invokeResult('referral-consent', { body: { programId: p.id, profileId: profileId || null, sharedFields } });
    notify(error?.message || data?.error || 'Referral requested. Your disclosure and consent have been recorded.');
  };

  if (loading) return <div className="h-[60vh] grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div>;

  return <div className="max-w-7xl mx-auto space-y-6 pb-12">
    <div><div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 mb-2"><ShieldCheck className="w-4 h-4"/>Verified sources only</div><h1 className="text-3xl font-black text-slate-900 dark:text-white">Degree Program Matcher</h1><p className="text-slate-500 mt-1">Compare verified programs against your academic profile, budget and study goals. Referral compensation is disclosed before consent.</p></div>

    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><SlidersHorizontal className="w-5 h-5 text-indigo-500"/>Personalized search</div>
      {user && <div><label className="text-xs font-bold text-slate-500">Match using profile</label><select value={profileId} onChange={e=>{setProfileId(e.target.value);selectProfile(user.id,e.target.value);}} className="mt-1 w-full md:w-96 block rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2.5">{profiles.map(p=><option key={p.id} value={p.id}>{p.profile_name || p.full_name}</option>)}</select>{!profiles.length && <p className="text-xs text-amber-600 mt-2">Create a Profile Studio profile to calculate fit scores.</p>}</div>}
      {!user && <p className="text-sm text-slate-500"><Link className="text-indigo-500 font-bold" to="/auth">Sign in</Link> to calculate personalized fit scores.</p>}
      <div className="grid md:grid-cols-4 gap-3"><div className="relative md:col-span-1"><Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Institution or field" className="w-full pl-9 pr-3 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"/></div><select value={country} onChange={e=>setCountry(e.target.value)} className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3">{countries.map(v=><option key={v}>{v}</option>)}</select><select value={level} onChange={e=>setLevel(e.target.value)} className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3">{levels.map(v=><option key={v}>{v}</option>)}</select><input type="number" min="0" value={maxBudget} onChange={e=>setMaxBudget(e.target.value)} placeholder="Max tuition (native currency)" className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3"/></div>
    </div>

    {!list.length ? <div className="p-10 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">No verified programs match these filters yet. The program research agent adds only sources that pass verification.</div> : <div className="grid md:grid-cols-2 gap-4">{list.map(p => <article key={p.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-bold text-emerald-600 mb-2"><ShieldCheck className="w-4 h-4"/>Verified program</div><h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{p.title}</h2><p className="text-sm text-slate-500 mt-1">{p.institution} · {p.country || 'Country not stated'} · {p.level || 'Level not stated'}</p></div>{p.fit.score !== null && <div className={`shrink-0 w-16 h-16 rounded-full grid place-items-center border-4 font-black ${p.fit.score>=80?'border-emerald-500 text-emerald-600':p.fit.score>=60?'border-amber-500 text-amber-600':'border-slate-300 text-slate-500'}`}>{p.fit.score}%</div>}</div>
      {p.tuition_amount != null && <p className="mt-3 font-bold text-slate-700 dark:text-slate-200">Tuition: {p.tuition_currency || ''} {Number(p.tuition_amount).toLocaleString()}</p>}
      {p.fit.reasons.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{p.fit.reasons.map(r=><span key={r} className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">✓ {r}</span>)}</div>}
      {p.fit.blockers.length > 0 && <div className="mt-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">{p.fit.blockers.map(r=><p key={r}>⚠ {r}</p>)}</div>}
      {Array.isArray(p.scholarships) && p.scholarships.length > 0 && <p className="mt-3 text-xs text-indigo-500 font-semibold"><Sparkles className="inline w-3.5 h-3.5 mr-1"/>{p.scholarships.length} scholarship/funding item(s) recorded</p>}
      <div className="mt-4 flex flex-wrap gap-2"><a href={p.official_url} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold flex gap-2"><ExternalLink className="w-4 h-4"/>Official page</a>{p.referral_enabled && <button onClick={()=>refer(p)} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold flex gap-2"><Handshake className="w-4 h-4"/>Request disclosed referral</button>}</div>
      {p.partner_disclosure && <p className="mt-3 text-xs text-slate-500"><strong>Partner disclosure:</strong> {p.partner_disclosure}</p>}
      <p className="mt-3 text-[11px] text-slate-400">Fit is decision support, not an admission guarantee. Always verify requirements on the official page.</p>
    </article>)}</div>}
  </div>;
}

async function invokeResult(name,options){try{return {data:await invokeFunction(name,options),error:null};}catch(error){return {data:null,error};}}
