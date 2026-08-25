import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../../context/AuthContext'; 
import { 
  Menu, Moon, Sun, GraduationCap, 
  BookOpen, LayoutDashboard, Sparkles, LogOut, User 
} from 'lucide-react';

// Initialize Supabase for avatar fetching
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Navbar({ toggleSidebar }) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Top Header Navigation Links (Always visible)
  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'AI Copilot', path: '/copilot', icon: Sparkles },
    { name: 'Blog', path: '/blog', icon: BookOpen },
  ];

  // Fetch User's Avatar Picture
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

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 transition-colors print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* --- LEFT: Logo & Mobile Toggle --- */}
          <div className="flex items-center shrink-0">
            {toggleSidebar && (
              <button
                onClick={toggleSidebar}
                className="p-2 mr-3 rounded-lg lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none text-slate-600 dark:text-slate-300 transition-colors"
                aria-label="Toggle navigation menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-indigo-600 p-1.5 rounded-lg group-hover:bg-indigo-500 transition-colors shadow-sm">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Scholar<span className="text-indigo-600 dark:text-indigo-400">Portal</span>
              </span>
            </Link>
          </div>
          
          {/* --- CENTER: Permanent Navigation Links --- */}
          <div className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const isActive = link.path === '/dashboard' 
                ? (location.pathname === '/' || location.pathname === '/dashboard')
                : location.pathname.startsWith(link.path);
              const Icon = link.icon;

              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isActive 
                      ? 'bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </div>

          {/* --- RIGHT: Theme & Account Actions --- */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-700/50"
              title="Toggle Theme"
              aria-label="Toggle theme mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            {user ? (
              <div className="flex items-center gap-2">
                <Link 
                  to="/settings" 
                  className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-all overflow-hidden flex items-center justify-center border border-slate-300 dark:border-slate-700 hover:border-indigo-500 shadow-sm" 
                  title="Settings"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-slate-400" />
                  )}
                </Link>
                <button 
                  onClick={signOut}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <Link 
                to="/auth" 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
          
        </div>
      </div>
    </nav>
  );
}