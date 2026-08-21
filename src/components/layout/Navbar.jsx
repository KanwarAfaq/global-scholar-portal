import React, { useState, useEffect, useMemo } from 'react';
import { Menu, Moon, Sun, GraduationCap, MapPin, BookOpen } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSearchParams, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../../context/AuthContext'; // Ensure this path matches your structure

// Initialize Supabase for the Navbar
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Navbar({ toggleSidebar }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [opportunities, setOpportunities] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState(null);

  const currentCountry = searchParams.get('country') || 'All';
  const currentType = searchParams.get('type') || 'All';

  // 1. Fetch Dynamic Dropdown Data
  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const { data, error } = await supabase
          .from('global_opportunities')
          .select('country, type');
          
        if (!error && data) setOpportunities(data);
      } catch (err) {
        console.error('Navbar failed to load dynamic filters:', err);
      }
    }
    fetchFilterOptions();
  }, []);

  // 2. Fetch User's Avatar Picture
  useEffect(() => {
    if (user) {
      async function fetchAvatar() {
        const { data } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq('user_id', user.id)
          .not('avatar_url', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();
          
        if (data && data.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }
      }
      fetchAvatar();
    }
  }, [user]);

  const availableCountries = useMemo(() => ['All', ...new Set(opportunities.map(o => o.country).filter(Boolean))].sort(), [opportunities]);
  const availableTypes = useMemo(() => ['All', ...new Set(opportunities.map(o => o.type).filter(Boolean))].sort(), [opportunities]);

  const handleFilterChange = (key, value) => {
    setSearchParams(prev => {
      if (value === 'All') prev.delete(key);
      else prev.set(key, value);
      return prev;
    });
  };

  return (
    <nav className="fixed top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 transition-colors print:hidden">
      <div className="px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between gap-4">
          
          {/* --- LEFT: Logo & Mobile Menu --- */}
          <div className="flex items-center shrink-0">
            <button
              onClick={toggleSidebar}
              className="p-2 mr-3 rounded-lg lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link to="/" className="flex items-center gap-2 lg:mr-6">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white hidden sm:block">
                Scholar<span className="text-indigo-600 dark:text-indigo-400">Portal</span>
              </span>
            </Link>
          </div>
          
          {/* --- CENTER: Global Filters --- */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-2xl px-4">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <MapPin className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <select 
                value={currentCountry}
                onChange={(e) => handleFilterChange('country', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block pl-10 pr-8 py-2.5 appearance-none cursor-pointer outline-none transition-all shadow-sm"
              >
                <option value="All">All Regions</option>
                {availableCountries.filter(c => c !== 'All').map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <BookOpen className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <select 
                value={currentType}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block pl-10 pr-8 py-2.5 appearance-none cursor-pointer outline-none transition-all shadow-sm"
              >
                <option value="All">All Degrees</option>
                {availableTypes.filter(t => t !== 'All').map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* --- RIGHT: Profile & Theme Toggle --- */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {/* The Updated Settings/Profile Link */}
            <Link 
              to="/settings" 
              className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors overflow-hidden flex items-center justify-center border-2 border-transparent hover:border-indigo-500" 
              title="Command Center"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              )}
            </Link>
          </div>
          
        </div>
      </div>
    </nav>
  );
}