import { COUNTRIES, LEVELS, FIELDS } from '../lib/opportunities';
import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Copy, ExternalLink, Loader2, MessageCircle, Moon, Save, Settings2, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';
import {useAuth} from '../context/session';
import {supabase} from '../context/../lib/supabase';

const defaults = {
  email_alerts_enabled: false,
  line_alerts_enabled: false,
  in_app_alerts_enabled: true,
  notify_new_matches: true,
  notify_watchlist_changes: true,
  notify_deadline_reminders: true,
  notify_application_updates: true,
  notify_sponsor_matches: true,
  notify_counselor_tasks: true,
  notify_referral_updates: true,
  notify_product_news: false,
  urgent_change_alerts: true,
  line_user_id: null,
  line_verification_code: '',
  line_verification_expires_at: null,
  alert_frequency: 'weekly',
  alert_countries: 'All',
  alert_levels: 'All',
  alert_fields: 'All',
  alert_countries_v2: [],
  alert_levels_v2: [],
  alert_fields_v2: [],
  default_route: '/dashboard',
  timezone: 'UTC',
  ai_summary_detail: 'short',
  currency: 'USD'
};

const timezoneOptions = ['UTC', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'];

function MultiSelect({ label, values, options, onChange }) {
  return <div>
    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{label}</label>
    <select multiple value={values || []} onChange={e => onChange(Array.from(e.target.selectedOptions, o => o.value))} className="w-full min-h-36 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
      {options.map(v => <option key={v} value={v}>{v}</option>)}
    </select>
    <p className="mt-1 text-[11px] text-slate-500">Use Ctrl/Cmd to select multiple items. Leave empty to match all.</p>
  </div>;
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState(defaults);
  const [metadata, setMetadata] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: existing, error }, { data: opps, error: metadataError }] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('global_opportunities').select('country,type,field').eq('verified', true).limit(2000)
      ]);
      if (error) setMessage('Settings could not be loaded: '+error.message);
      if(metadataError)setMessage('Using standard filter options; opportunity filters could not be loaded.');
      if (existing) setSettings({
        ...defaults,
        ...existing,
        alert_countries_v2: existing.alert_countries_v2?.length ? existing.alert_countries_v2 : (existing.alert_countries && existing.alert_countries !== 'All' ? [existing.alert_countries] : []),
        alert_levels_v2: existing.alert_levels_v2?.length ? existing.alert_levels_v2 : (existing.alert_levels && existing.alert_levels !== 'All' ? [existing.alert_levels] : []),
        alert_fields_v2: existing.alert_fields_v2?.length ? existing.alert_fields_v2 : (existing.alert_fields && existing.alert_fields !== 'All' ? [existing.alert_fields] : [])
      });
      setMetadata(opps || []);
      setLoading(false);
    })();
  }, [user]);

  const countries = useMemo(() => [...new Set([...COUNTRIES,...metadata.map(x => x.country).filter(Boolean),...(settings.alert_countries_v2||[])])].sort(), [metadata,settings]);
  const levels = useMemo(() => [...new Set([...LEVELS,...metadata.map(x => x.type).filter(Boolean),...(settings.alert_levels_v2||[])])].sort(), [metadata,settings]);
  const fields = useMemo(() => [...new Set([...FIELDS,...metadata.map(x => x.field).filter(Boolean),...(settings.alert_fields_v2||[])])].sort(), [metadata,settings]);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));
  const newVerificationCode = () => {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return String(100000 + (bytes[0] % 900000));
  };
  const toggleLine = async checked => {
    if (!checked) return update('line_alerts_enabled', false);
    const stillValid = settings.line_verification_code && settings.line_verification_expires_at && new Date(settings.line_verification_expires_at) > new Date();
    const code = stillValid ? settings.line_verification_code : newVerificationCode();
    const expiresAt = stillValid ? settings.line_verification_expires_at : new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const next = { line_alerts_enabled: true, line_verification_code: code, line_verification_expires_at: expiresAt };
    const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) { setMessage(`Could not create LINE verification code: ${error.message}`); return; }
    setSettings(prev => ({ ...prev, ...next }));
  };

  const save = async e => {
    e.preventDefault();
    setSaving(true); setMessage('');
    const payload = {
      ...settings,
      user_id: user.id,
      theme_preference: theme,
      // Keep the old singular columns synchronized for backwards compatibility.
      alert_countries: settings.alert_countries_v2?.[0] || 'All',
      alert_levels: settings.alert_levels_v2?.[0] || 'All',
      alert_fields: settings.alert_fields_v2?.[0] || 'All',
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' });
    setSaving(false);
    setMessage(error ? `Could not save: ${error.message}` : 'Settings saved.');
  };

  if (loading) return <div className="h-[60vh] grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return <form onSubmit={save} className="max-w-5xl mx-auto pb-12 space-y-6">
    <div>
      <h1 className="text-3xl font-black text-slate-900 dark:text-white">Settings</h1>
      <p className="text-slate-500 mt-1">Control alert delivery, targeting, appearance and account preferences.</p>
    </div>

    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6">
      <div className="flex items-center gap-3"><Bell className="text-indigo-500"/><div><h2 className="font-extrabold text-slate-900 dark:text-white">Smart alerts</h2><p className="text-sm text-slate-500">Delivery agents respect frequency, target criteria and per-opportunity deduplication.</p></div></div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Toggle label="In-app" note="Notification center" checked={settings.in_app_alerts_enabled} onChange={v=>update('in_app_alerts_enabled',v)}/>
        <Toggle label="Email via SMTP" note="Digests and enabled topics" checked={settings.email_alerts_enabled} onChange={v=>update('email_alerts_enabled',v)}/>
        <Toggle label="LINE" note="Direct bot alerts" checked={settings.line_alerts_enabled} onChange={toggleLine}/>
      </div>
      <div><h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">Choose what you want to receive</h3><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Toggle label="New profile matches" checked={settings.notify_new_matches} onChange={v=>update('notify_new_matches',v)}/>
        <Toggle label="Watchlist changes" checked={settings.notify_watchlist_changes} onChange={v=>update('notify_watchlist_changes',v)}/>
        <Toggle label="Deadline reminders" checked={settings.notify_deadline_reminders} onChange={v=>update('notify_deadline_reminders',v)}/>
        <Toggle label="Application updates" checked={settings.notify_application_updates} onChange={v=>update('notify_application_updates',v)}/>
        <Toggle label="Sponsored matches" checked={settings.notify_sponsor_matches} onChange={v=>update('notify_sponsor_matches',v)}/>
        <Toggle label="Counselor tasks" checked={settings.notify_counselor_tasks} onChange={v=>update('notify_counselor_tasks',v)}/>
        <Toggle label="Referral updates" checked={settings.notify_referral_updates} onChange={v=>update('notify_referral_updates',v)}/>
        <Toggle label="Product/news" checked={settings.notify_product_news} onChange={v=>update('notify_product_news',v)}/>
        <Toggle label="Urgent changes immediately" checked={settings.urgent_change_alerts} onChange={v=>update('urgent_change_alerts',v)}/>
      </div></div>

      {settings.line_alerts_enabled && !settings.line_user_id && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex gap-3"><MessageCircle className="text-emerald-500 shrink-0"/><div><p className="font-bold text-slate-900 dark:text-white">Connect LINE</p><p className="text-sm text-slate-500">Send this 6-digit verification code to your configured ScholarPortal LINE bot. It expires after 15 minutes:</p><div className="mt-2 inline-flex items-center gap-3 bg-slate-950 text-white px-4 py-2 rounded-lg"><span className="font-mono font-black tracking-[.2em]">{settings.line_verification_code}</span><button type="button" onClick={async()=>{await navigator.clipboard.writeText(settings.line_verification_code);setCopied(true);setTimeout(()=>setCopied(false),1500)}}>{copied?<CheckCircle2 className="w-4 h-4 text-emerald-400"/>:<Copy className="w-4 h-4"/>}</button></div></div></div>}

      <div className="grid md:grid-cols-2 gap-5">
        <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Digest frequency</label><select value={settings.alert_frequency} onChange={e=>update('alert_frequency',e.target.value)} className="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
        <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Timezone</label><select value={settings.timezone} onChange={e=>update('timezone',e.target.value)} className="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3">{timezoneOptions.map(z=><option key={z}>{z}</option>)}</select></div>
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <MultiSelect label="Countries" values={settings.alert_countries_v2} options={countries} onChange={v=>update('alert_countries_v2',v)} />
        <MultiSelect label="Levels / types" values={settings.alert_levels_v2} options={levels} onChange={v=>update('alert_levels_v2',v)} />
        <MultiSelect label="Fields" values={settings.alert_fields_v2} options={fields} onChange={v=>update('alert_fields_v2',v)} />
      </div>
    </section>

    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
      <div className="flex items-center gap-3"><Settings2 className="text-indigo-500"/><div><h2 className="font-extrabold text-slate-900 dark:text-white">Portal preferences</h2><p className="text-sm text-slate-500">These settings affect your application workspace.</p></div></div>
      <div className="grid md:grid-cols-3 gap-4">
        <div><label className="block text-sm font-bold mb-2">Default page</label><select value={settings.default_route} onChange={e=>update('default_route',e.target.value)} className="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-3"><option value="/dashboard">Global Feed</option><option value="/intelligence">Watchlists</option><option value="/applications">Applications</option><option value="/copilot">Application Studio</option><option value="/analytics">Analytics</option></select></div>
        <div><label className="block text-sm font-bold mb-2">AI detail</label><select value={settings.ai_summary_detail} onChange={e=>update('ai_summary_detail',e.target.value)} className="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-3"><option value="short">Concise</option><option value="detailed">Detailed</option></select></div>
        <div><label className="block text-sm font-bold mb-2">Currency</label><select value={settings.currency} onChange={e=>update('currency',e.target.value)} className="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-3"><option>USD</option><option>EUR</option><option>GBP</option><option>TWD</option><option>AUD</option><option>CAD</option><option>JPY</option></select></div>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setTheme('light')} className={`px-3 py-2 rounded-lg border flex gap-2 ${theme==='light'?'border-indigo-500 text-indigo-500':'border-slate-200 dark:border-slate-700'}`}><Sun className="w-4 h-4"/>Light</button><button type="button" onClick={()=>setTheme('dark')} className={`px-3 py-2 rounded-lg border flex gap-2 ${theme==='dark'?'border-indigo-500 text-indigo-500':'border-slate-200 dark:border-slate-700'}`}><Moon className="w-4 h-4"/>Dark</button></div>
    </section>

    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
      <h2 className="font-extrabold text-slate-900 dark:text-white">Profile & account</h2><p className="text-sm text-slate-500 mt-1">Eligibility details live in Profile Studio; exports, deletion and security controls live in Account.</p><div className="flex flex-wrap gap-3 mt-4"><Link to="/profiles" className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold flex items-center gap-2">Profile Studio <ExternalLink className="w-4 h-4"/></Link><Link to="/account" className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold flex items-center gap-2">Account & data <ExternalLink className="w-4 h-4"/></Link></div>
    </section>

    <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-2xl bg-slate-950/95 text-white px-5 py-4 shadow-xl border border-slate-800"><span className={`text-sm ${message.startsWith('Could')?'text-rose-300':'text-emerald-300'}`}>{message || 'Changes are not applied until you save.'}</span><button disabled={saving} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center gap-2">{saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}Save settings</button></div>
  </form>;
}

function Toggle({label,note,checked,onChange}){return <label className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex gap-3 items-start cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition"><input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)} className="mt-1 accent-indigo-600"/><span><strong className="block text-sm text-slate-900 dark:text-white">{label}</strong>{note&&<small className="text-slate-500">{note}</small>}</span></label>}
