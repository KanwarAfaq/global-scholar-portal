import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { User, Save, Loader2, BookOpen, Wrench, Plus, Trash2, FileText } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

const emptyProfile = { profile_name: '', full_name: '', bio: '', skills: '' };

export default function Profile() {
  const { user, signOut } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user]);

  async function fetchProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
        
      if (error) throw error;
      setProfiles(data || []);
      
      // Auto-select the first profile if exists, else start fresh
      if (data && data.length > 0) {
        setActiveProfile(data[0]);
      } else {
        setActiveProfile(emptyProfile);
      }
    } catch (err) {
      console.error("Error fetching profiles:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        profile_name: activeProfile.profile_name || 'My Profile',
        full_name: activeProfile.full_name,
        bio: activeProfile.bio,
        skills: activeProfile.skills,
        updated_at: new Date()
      };

      // If we have an ID, update it. If not, insert it.
      if (activeProfile.id) {
        payload.id = activeProfile.id;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      
      alert("Profile saved successfully!");
      fetchProfiles(); // Refresh list to get new IDs
    } catch (err) {
      alert("Error saving profile: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevent selecting the profile when clicking delete
    if (!window.confirm("Are you sure you want to delete this profile?")) return;
    
    try {
      const { error } = await supabase.from('user_profiles').delete().eq('id', id);
      if (error) throw error;
      
      fetchProfiles();
    } catch (err) {
      alert("Error deleting profile: " + err.message);
    }
  };

  const handleCreateNew = () => {
    setActiveProfile(emptyProfile);
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 pb-10">
      
      {/* Left Sidebar: Profile List */}
      <div className="w-full md:w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shrink-0 shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
          <h2 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-500" /> My Profiles
          </h2>
          <button 
            onClick={handleCreateNew}
            className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
            title="Create New Profile"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none">
          {profiles.length === 0 ? (
            <p className="text-sm text-slate-500 text-center p-4">No profiles yet. Create one to power your AI Copilot!</p>
          ) : (
            profiles.map(p => (
              <div
                key={p.id}
                onClick={() => setActiveProfile(p)}
                className={`w-full text-left p-4 rounded-2xl transition-all cursor-pointer flex justify-between items-start group ${
                  activeProfile.id === p.id 
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 border' 
                    : 'bg-transparent border-transparent border hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{p.profile_name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{p.full_name}</p>
                </div>
                <button 
                  onClick={(e) => handleDelete(e, p.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
        
        {/* Sign Out Button at bottom of sidebar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button 
            onClick={signOut}
            className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Right Content: Profile Form */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {activeProfile.id ? 'Edit Profile' : 'Create New Profile'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tailor your background for specific applications.</p>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                <FileText className="w-4 h-4 text-indigo-500" /> Profile Name (For your eyes only)
              </label>
              <input
                type="text"
                required
                value={activeProfile.profile_name || ''}
                onChange={(e) => setActiveProfile({ ...activeProfile, profile_name: e.target.value })}
                placeholder="e.g., Software Engineering Profile"
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                <User className="w-4 h-4 text-indigo-500" /> Full Legal Name
              </label>
              <input
                type="text"
                required
                value={activeProfile.full_name || ''}
                onChange={(e) => setActiveProfile({ ...activeProfile, full_name: e.target.value })}
                placeholder="e.g., John Doe"
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <BookOpen className="w-4 h-4 text-indigo-500" /> Professional Bio & Experience
            </label>
            <textarea
              rows="5"
              value={activeProfile.bio || ''}
              onChange={(e) => setActiveProfile({ ...activeProfile, bio: e.target.value })}
              placeholder="Detail your experience tailored to this profile's goal..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              <Wrench className="w-4 h-4 text-indigo-500" /> Skills & Certifications
            </label>
            <textarea
              rows="3"
              value={activeProfile.skills || ''}
              onChange={(e) => setActiveProfile({ ...activeProfile, skills: e.target.value })}
              placeholder="e.g., React, Python, Project Management..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}