import { activeProfileId, selectProfile } from '../lib/profile';
import { invokeFunction } from '../lib/functions';
import { notify } from '../lib/notify';
import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ShieldCheck, Send, ExternalLink, Sparkles } from 'lucide-react';
import {useAuth} from '../context/session';
import {supabase} from '../context/../lib/supabase';

const text = (v) => String(v ?? '').trim().toLowerCase();
const list = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const overlaps = (targets, values) => {
  const haystack = values.map(text).join(' ');
  return list(targets).some((target) => haystack.includes(text(target)) || text(target).includes(haystack));
};

function profileTerms(profile) {
  return [
    profile?.desired_degree,
    profile?.citizenship,
    profile?.location,
    ...list(profile?.desired_countries),
    JSON.stringify(profile?.research_interests),
    JSON.stringify(profile?.technical_skills),
    ...list(profile?.education).flatMap((item) => [item?.degree, item?.institution, item?.thesis]),
  ].filter(Boolean);
}

function campaignFit(campaign, profile) {
  if (!profile) return { score: 0, reasons: ['Select a profile to calculate your fit.'] };
  const targets = {
    countries: list(campaign.target_countries),
    levels: list(campaign.target_levels),
    fields: list(campaign.target_fields),
  };
  const allEmpty = !targets.countries.length && !targets.levels.length && !targets.fields.length;
  const terms = profileTerms(profile);
  let earned = 0;
  let possible = 0;
  const reasons = [];

  if (targets.countries.length) {
    possible += 35;
    const countryValues = [profile.citizenship, profile.location, ...list(profile.desired_countries)];
    if (overlaps(targets.countries, countryValues)) { earned += 35; reasons.push('Country/citizenship target matches'); }
    else reasons.push('Country target does not clearly match');
  }
  if (targets.levels.length) {
    possible += 30;
    const levelValues = [profile.desired_degree, ...list(profile.education).map((e) => e?.degree)];
    if (overlaps(targets.levels, levelValues)) { earned += 30; reasons.push('Study level matches'); }
    else reasons.push('Study level is not an obvious match');
  }
  if (targets.fields.length) {
    possible += 35;
    if (overlaps(targets.fields, terms)) { earned += 35; reasons.push('Academic/skills field matches'); }
    else reasons.push('Field target is not an obvious match');
  }
  if (allEmpty) return { score: 60, reasons: ['Campaign is open broadly; sponsor did not specify targeting filters.'] };
  return { score: possible ? Math.round((earned / possible) * 100) : 0, reasons };
}

export default function SponsoredOpportunities() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState('');

  const load = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('sponsor_campaigns').select('*,sponsor_accounts(organization_name,verified)').eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    ]);
    setCampaigns(c || []);
    setProfiles(p || []);
    if (!profileId && p?.[0]) setProfileId(p.find(x=>x.id===activeProfileId(user.id))?.id||p[0].id);
  };

  useEffect(() => { if (user) load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProfile = profiles.find((p) => p.id === profileId);
  const rankedCampaigns = useMemo(() => campaigns
    .map((campaign) => ({ ...campaign, fit: campaignFit(campaign, selectedProfile) }))
    .sort((a, b) => b.fit.score - a.fit.score), [campaigns, selectedProfile]);

  const interested = async (campaign) => {
    if (!profileId) return notify('Create/select a profile first.');
    const sharedFields = [
      'full_name', 'contact_email', 'location', 'citizenship', 'desired_countries', 'desired_degree',
      'education', 'technical_skills', 'research_interests', 'languages', 'english_test',
    ];
    const readable = sharedFields.join(', ').replaceAll('_', ' ');
    const ok = confirm(`Share these selected profile fields with ${campaign.sponsor_accounts?.organization_name || 'this sponsor'} for “${campaign.title}” only?\n\n${readable}\n\nScholarPortal records this consent per campaign; it does not silently sell your whole profile.`);
    if (!ok) return;
    const { data, error } = await invokeResult('lead-consent', { body: { campaignId: campaign.id, profileId, sharedFields } });
    if (error || data?.error) notify(data?.error || error.message);
    else notify('Interest sent with your explicit consent.');
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-black text-slate-900 dark:text-white">Sponsored Opportunities</h1>
      <p className="text-slate-500">Campaigns are ranked against your selected profile. No profile fields are sent to a sponsor until you explicitly consent for that campaign.</p>
    </div>
    <select value={profileId} onChange={(e) => {setProfileId(e.target.value);selectProfile(user.id,e.target.value);}} className="w-full sm:w-auto px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <option value="">Choose profile for matching and consented sharing</option>
      {profiles.map((p) => <option value={p.id} key={p.id}>{p.profile_name || p.full_name}</option>)}
    </select>
    <div className="grid md:grid-cols-2 gap-4">
      {rankedCampaigns.map((c) => <article key={c.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">
          <Building2 className="w-4 h-4" />{c.sponsor_accounts?.organization_name || 'Sponsor'}
          {c.sponsor_accounts?.verified && <ShieldCheck aria-label="Verified sponsor" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          {selectedProfile && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1"><Sparkles className="w-3 h-3" />{c.fit.score}% profile fit</span>}
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{c.title}</h2>
        <p className="text-sm text-slate-500 mt-2">{c.description}</p>
        {selectedProfile && <ul className="mt-3 text-xs text-slate-500 space-y-1">{c.fit.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>}
        <div className="flex flex-wrap gap-2 mt-3 text-xs">{[...list(c.target_levels), ...list(c.target_fields), ...list(c.target_countries)].map((x) => <span key={x} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">{x}</span>)}</div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => interested(c)} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex gap-2"><Send className="w-4 h-4"/>I'm interested</button>
          {c.destination_url && <a href={c.destination_url} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-sm flex gap-2"><ExternalLink className="w-4 h-4"/>Sponsor page</a>}
        </div>
      </article>)}
    </div>
    {!rankedCampaigns.length && <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500">No active sponsored campaigns are available right now.</div>}
  </div>;
}

async function invokeResult(name,options){try{return {data:await invokeFunction(name,options),error:null};}catch(error){return {data:null,error};}}
