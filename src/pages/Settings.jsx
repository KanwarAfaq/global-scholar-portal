import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Palette, Shield, Save, Loader2, 
  Mail, AlertTriangle, User, Plus, Trash2, 
  Image as ImageIcon, BookOpen, Wrench, FileText,
  Sun, Moon, MessageCircle, CheckCircle2, Copy
} from 'lucide-react';
import { useTheme } from 'next-themes';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const emptyProfile = { profile_name: '', full_name: '', bio: '', skills: '', avatar_url: '' };

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState('notifications');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // --- STATE: User Settings ---
  const [settings, setSettings] = useState({
    email_alerts_enabled: false,
    line_alerts_enabled: false,
    line_user_id: null,
    line_verification_code: '',
    alert_frequency: 'weekly',
    alert_countries: 'All',
    alert_levels: 'All',
    alert_fields: 'All',
    default_route: '/dashboard',
    timezone: 'UTC',
    ai_summary_detail: 'short',
    currency: 'USD'
  });

  // --- STATE: Profiles & Data ---
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(emptyProfile);
  const [opportunitiesMetadata, setOpportunitiesMetadata] = useState([]);

  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchProfiles();
      fetchOpportunitiesMetadata();
    }
  }, [user]);

  async function fetchSettings() {
    try {
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings({
          email_alerts_enabled: data.email_alerts_enabled || false,
          line_alerts_enabled: data.line_alerts_enabled || false,
          line_user_id: data.line_user_id || null,
          line_verification_code: data.line_verification_code || '',
          alert_frequency: data.alert_frequency || 'weekly',
          alert_countries: data.alert_countries || 'All',
          alert_levels: data.alert_levels || 'All',
          alert_fields: data.alert_fields || 'All',
          default_route: data.default_route || '/dashboard',
          timezone: data.timezone || 'UTC',
          ai_summary_detail: data.ai_summary_detail || 'short',
          currency: data.currency || 'USD'
        });
      }
    } catch (err) { console.error("Error fetching settings:", err); }
  }

  async function fetchProfiles() {
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
      if (error) throw error;
      setProfiles(data || []);
      if (data && data.length > 0) setActiveProfile(data[0]);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  async function fetchOpportunitiesMetadata() {
    try {
      const { data, error } = await supabase.from('global_opportunities').select('country, type, field');
      if (!error && data) setOpportunitiesMetadata(data);
    } catch (err) { console.error(err); }
  }

  const availableCountries = useMemo(() => ['All', ...new Set(opportunitiesMetadata.map(o => o.country).filter(Boolean))].sort(), [opportunitiesMetadata]);
  const availableTypes = useMemo(() => ['All', ...new Set(opportunitiesMetadata.map(o => o.type).filter(Boolean))].sort(), [opportunitiesMetadata]);
  const availableFields = useMemo(() => ['All', ...new Set(opportunitiesMetadata.map(o => o.field).filter(Boolean))].sort(), [opportunitiesMetadata]);

  // Generate a random 6-digit code for LINE verification
  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

 const handleSettingsChange = async (e) => {
    const { name, value, type, checked } = e.target;
    
    // Special handling for the LINE toggle
    if (name === 'line_alerts_enabled') {
      if (checked && !settings.line_verification_code) {
        const newCode = generateVerificationCode();
        
        // 1. Update the UI instantly
        setSettings(prev => ({ 
          ...prev, 
          [name]: checked,
          line_verification_code: newCode
        }));
        
        // 2. Silently auto-save to Supabase in the background
        try {
          await supabase.from('user_settings').upsert({
            user_id: user.id,
            line_alerts_enabled: true,
            line_verification_code: newCode,
            updated_at: new Date()
          });
        } catch (err) {
          console.error("Failed to auto-save LINE code:", err);
        }
      } else {
        setSettings(prev => ({ ...prev, [name]: checked }));
      }
    } 
    // Handling for all other normal settings
    else {
      setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage('');
    try {
      const payload = { user_id: user.id, ...settings, theme_preference: theme, updated_at: new Date() };
      const { error } = await supabase.from('user_settings').upsert(payload);
      if (error) throw error;
      setStatusMessage('Settings saved successfully! ✨');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) { setStatusMessage(`❌ Error: ${err.message}`); } 
    finally { setSaving(false); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage('');
    try {
      const payload = {
        user_id: user.id,
        profile_name: activeProfile.profile_name || 'My Profile',
        full_name: activeProfile.full_name,
        bio: activeProfile.bio,
        skills: activeProfile.skills,
        avatar_url: activeProfile.avatar_url,
        updated_at: new Date()
      };
      if (activeProfile.id) payload.id = activeProfile.id;

      const { error } = await supabase.from('user_profiles').upsert(payload);
      if (error) throw error;
      
      setStatusMessage('AI Profile saved successfully! 🤖');
      fetchProfiles();
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) { setStatusMessage(`❌ Error: ${err.message}`); } 
    finally { setSaving(false); }
  };

  const handleDeleteProfile = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this AI Profile?")) return;
    try {
      await supabase.from('user_profiles').delete().eq('id', id);
      fetchProfiles();
      setActiveProfile(emptyProfile);
    } catch (err) { alert(err.message); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    setStatusMessage('Uploading image...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        setActiveProfile({ ...activeProfile, avatar_url: data.secure_url });
        setStatusMessage('Image uploaded! Click "Save Profile" to keep it.');
      } else throw new Error('Upload failed');
    } catch (err) {
      console.error(err);
      setStatusMessage('❌ Error uploading image to Cloudinary.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(settings.line_verification_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading) return <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-8 w-full block">
      
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Command Center</h1>
        <p className="text-gray-400">Manage your AI Profiles, automation rules, and portal preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start w-full">
        
        {/* Left Sidebar Tabs (3 Columns) */}
        <div className="md:col-span-4 lg:col-span-3 flex flex-row md:flex-col gap-2 overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab('profiles')} className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'profiles' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            <User className="w-5 h-5 shrink-0" /> AI Profiles
          </button>
          <button onClick={() => setActiveTab('notifications')} className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'notifications' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            <Bell className="w-5 h-5 shrink-0" /> Opportunity Alerts
          </button>
          <button onClick={() => setActiveTab('preferences')} className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'preferences' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            <Palette className="w-5 h-5 shrink-0" /> App Preferences
          </button>
          <button onClick={() => setActiveTab('account')} className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'account' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            <Shield className="w-5 h-5 shrink-0" /> Security
          </button>
        </div>

        {/* Right Content Area (9 Columns) */}
        <div className="md:col-span-8 lg:col-span-9 w-full min-w-0 bg-[#0F172A] border border-white/10 rounded-[2rem] p-6 md:p-10 shadow-2xl">
          
          {/* AI PROFILES TAB */}
          {activeTab === 'profiles' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Your AI Profiles</h2>
                  <p className="text-sm text-gray-400">Tailor multiple profiles to discover specific opportunities.</p>
                </div>
                <button onClick={() => setActiveProfile(emptyProfile)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                  <Plus className="w-4 h-4" /> New Profile
                </button>
              </div>

              {/* Profile Selector */}
              {profiles.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {profiles.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => setActiveProfile(p)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border flex items-center gap-2 whitespace-nowrap ${activeProfile.id === p.id ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-transparent border-white/10 text-gray-400 hover:border-white/30'}`}
                    >
                      {p.profile_name}
                      {activeProfile.id === p.id && (
                        <Trash2 className="w-4 h-4 hover:text-red-400 ml-2 cursor-pointer" onClick={(e) => handleDeleteProfile(e, p.id)} />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Profile Form */}
              <form onSubmit={handleSaveProfile} className="space-y-6 bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Avatar Upload */}
                  <div className="shrink-0 flex flex-col items-center gap-4">
                    <div className="w-32 h-32 rounded-full border-4 border-indigo-500/30 overflow-hidden bg-gray-800 flex items-center justify-center relative group">
                      {activeProfile.avatar_url ? (
                        <img src={activeProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-12 h-12 text-gray-500" />
                      )}
                      <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <ImageIcon className="w-6 h-6 text-white" />}
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                      </label>
                    </div>
                    <span className="text-xs text-gray-400">Upload Photo</span>
                  </div>

                  {/* Basic Info */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Profile Name</label>
                      <input type="text" value={activeProfile.profile_name} onChange={e => setActiveProfile({...activeProfile, profile_name: e.target.value})} placeholder="e.g., Data Science Path" className="w-full bg-[#111827] text-white text-sm px-4 py-3 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Full Name</label>
                      <input type="text" value={activeProfile.full_name} onChange={e => setActiveProfile({...activeProfile, full_name: e.target.value})} placeholder="Your legal name" className="w-full bg-[#111827] text-white text-sm px-4 py-3 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500" required />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Bio / Background</label>
                  <textarea value={activeProfile.bio} onChange={e => setActiveProfile({...activeProfile, bio: e.target.value})} placeholder="Briefly describe your academic and professional background..." rows={4} className="w-full bg-[#111827] text-white text-sm px-4 py-3 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 resize-none" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Skills & Interests (Comma separated)</label>
                  <input type="text" value={activeProfile.skills} onChange={e => setActiveProfile({...activeProfile, skills: e.target.value})} placeholder="Machine Learning, Python, Climate Change..." className="w-full bg-[#111827] text-white text-sm px-4 py-3 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500" />
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-white/10">
                  <button type="submit" disabled={saving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Profile
                  </button>
                  {statusMessage && <span className={`text-sm font-bold ${statusMessage.includes('❌') ? 'text-red-400' : 'text-emerald-400'}`}>{statusMessage}</span>}
                </div>
              </form>
            </motion.div>
          )}

          {/* ALERTS & SETTINGS FORMS */}
          {(activeTab === 'notifications' || activeTab === 'preferences' || activeTab === 'account') && (
            <form onSubmit={handleSaveSettings} className="space-y-8 w-full">
              
              {/* NOTIFICATIONS TAB */}
              {activeTab === 'notifications' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Alert Channels</h2>
                    <p className="text-sm text-gray-400 mb-6">Choose how the AI Matchmaker notifies you of new opportunities.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                      {/* Email Toggle */}
                      <div className="flex flex-col p-5 bg-white/5 border border-white/10 rounded-2xl gap-5">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl shrink-0 ${settings.email_alerts_enabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-800 text-gray-500'}`}>
                              <Mail className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-white text-sm">Email Digest</h3>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" name="email_alerts_enabled" checked={settings.email_alerts_enabled} onChange={handleSettingsChange} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                        <p className="text-xs text-gray-400">Receive beautiful HTML summaries directly to your inbox based on your frequency settings.</p>
                      </div>

                      {/* LINE Toggle */}
                      <div className={`flex flex-col p-5 border rounded-2xl gap-5 transition-all ${settings.line_alerts_enabled ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl shrink-0 ${settings.line_alerts_enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                              <MessageCircle className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-white text-sm">LINE Bot Alerts</h3>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" name="line_alerts_enabled" checked={settings.line_alerts_enabled} onChange={handleSettingsChange} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                        <p className="text-xs text-gray-400">Get instant, punchy text alerts delivered directly to your LINE messenger.</p>
                      </div>
                    </div>

                    {/* LINE VERIFICATION UI (Only shows if LINE is enabled) */}
                    <AnimatePresence>
                      {settings.line_alerts_enabled && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-8"
                        >
                          <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row gap-6 items-center">
                            
                            {/* Make sure to replace @yourbotid with your actual Basic ID from LINE Console */}
                            <div className="w-32 h-32 shrink-0 bg-white p-2 rounded-xl border-4 border-emerald-500/30">
                              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://line.me/R/ti/p/@438locrj" alt="LINE Bot QR" className="w-full h-full object-contain opacity-80 hover:opacity-100 transition-opacity" />
                            </div>
                            
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-2">
                                {settings.line_user_id ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                                    <CheckCircle2 className="w-4 h-4" /> Account Successfully Linked
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                                    <AlertTriangle className="w-4 h-4" /> Pending Verification
                                  </span>
                                )}
                              </div>
                              
                              <h4 className="text-lg font-bold text-white">Connect Your LINE Account</h4>
                              <ol className="text-sm text-gray-300 space-y-1.5 list-decimal list-inside">
                                <li>Scan the QR code to add <strong>ScholarPortal Bot</strong> on LINE.</li>
                                <li>Send the exact 6-digit code below to the bot in the chat.</li>
                              </ol>
                              
                              <div className="mt-3 inline-flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/10">
                                <span className="font-mono text-xl font-bold tracking-[0.2em] text-emerald-400">{settings.line_verification_code}</span>
                                <button type="button" onClick={copyToClipboard} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                  {copiedCode ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Filter Rules */}
                  <div className={`space-y-5 transition-all duration-300 ${(!settings.email_alerts_enabled && !settings.line_alerts_enabled) ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">Target Criteria</h3>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Alert Frequency (Email Only)</label>
                      <select name="alert_frequency" value={settings.alert_frequency} onChange={handleSettingsChange} className="w-full bg-[#111827] text-white text-sm px-4 py-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                        <option value="daily">Daily Digest</option>
                        <option value="weekly">Weekly Summary</option>
                        <option value="monthly">Monthly Overview</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">Target Country</label>
                        <select name="alert_countries" value={settings.alert_countries} onChange={handleSettingsChange} className="w-full bg-[#111827] text-white text-sm px-4 py-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                          {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">Target Level</label>
                        <select name="alert_levels" value={settings.alert_levels} onChange={handleSettingsChange} className="w-full bg-[#111827] text-white text-sm px-4 py-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                          {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Target Discipline</label>
                      <select name="alert_fields" value={settings.alert_fields} onChange={handleSettingsChange} className="w-full bg-[#111827] text-white text-sm px-4 py-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                        {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PREFERENCES TAB */}
              {activeTab === 'preferences' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">App Preferences</h2>
                    <p className="text-sm text-gray-400 mb-6">Customize your portal experience.</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Default Landing Page</label>
                      <select name="default_route" value={settings.default_route} onChange={handleSettingsChange} className="w-full bg-[#111827] text-white text-sm px-4 py-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                        <option value="/dashboard">Dashboard</option>
                        <option value="/copilot">AI Copilot</option>
                        <option value="/applications">My Applications</option>
                        <option value="/analytics">My Analytics</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">AI Summary Detail Level</label>
                      <select name="ai_summary_detail" value={settings.ai_summary_detail} onChange={handleSettingsChange} className="w-full bg-[#111827] text-white text-sm px-4 py-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                        <option value="short">Short & Punchy</option>
                        <option value="detailed">Highly Detailed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Preferred Currency Display</label>
                      <select name="currency" value={settings.currency} onChange={handleSettingsChange} className="w-full bg-[#111827] text-white text-sm px-4 py-3.5 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ACCOUNT TAB */}
              {activeTab === 'account' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Security & Account</h2>
                    <p className="text-sm text-gray-400 mb-6">Manage your login credentials.</p>
                  </div>

                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Email Address</h3>
                      <p className="text-sm text-gray-400 mt-1">{user?.email}</p>
                    </div>
                    <button type="button" className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold transition-colors">
                      Change Email
                    </button>
                  </div>

                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Password</h3>
                      <p className="text-sm text-gray-400 mt-1">Last updated recently</p>
                    </div>
                    <button type="button" className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-lg text-sm font-bold transition-colors">
                      Reset Password
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Global Save Action (Only for Notification and Preferences tabs) */}
              {activeTab !== 'account' && (
                <div className="pt-8 border-t border-white/10 flex items-center justify-between">
                  <button type="submit" disabled={saving} className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Settings
                  </button>
                  {statusMessage && <span className={`font-bold text-sm ${statusMessage.includes('❌') ? 'text-red-400' : 'text-emerald-400'}`}>{statusMessage}</span>}
                </div>
              )}
            </form>
          )}

        </div>
      </div>
    </div>
  );
}