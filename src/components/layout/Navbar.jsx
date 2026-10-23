import {supabase} from '../../lib/supabase';
import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {useAuth} from '../../context/session'; 
import { 
  Menu, X, Moon, Sun, GraduationCap, School, Tag,
  BookOpen, LayoutDashboard, Sparkles, LogOut, User 
} from 'lucide-react';

// Initialize Supabase for avatar fetching


export default function Navbar({ toggleSidebar }) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Top Header Navigation Links (Always visible)
  // Link straight to '/', not '/dashboard' (which only redirects), so crawlers and users skip a hop.
  const navLinks = [
    { name: 'Scholarships', path: '/', icon: LayoutDashboard },
    { name: 'Programs', path: '/programs', icon: School },
    { name: 'Blog', path: '/blog', icon: BookOpen },
    { name: 'AI Copilot', path: '/copilot', icon: Sparkles },
    { name: 'Pricing', path: '/pricing', icon: Tag, wideOnly: true },
  ];
  const isActiveLink = path => (path === '/' ? location.pathname === '/' || location.pathname === '/dashboard' : location.pathname === path || location.pathname.startsWith(path + '/'));
  const [menuOpen, setMenuOpen] = useState(false);
  // Close the mobile menu after navigating and when Escape is pressed.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = event => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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
    <nav className="sticky top-0 z-50 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 transition-colors print:hidden">
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
              <span className="hidden sm:inline text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Scholar<span className="text-indigo-600 dark:text-indigo-400">Portal</span>
              </span>
            </Link>
          </div>
          
          {/* --- CENTER: Permanent Navigation Links (tablet and up) --- */}
          <div className="hidden md:flex items-center gap-0.5 lg:gap-2" role="navigation" aria-label="Primary">
            {navLinks.map((link) => {
              const isActive = isActiveLink(link.path);
              const Icon = link.icon;

              return (
                <Link
                  key={link.name}
                  to={link.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${link.wideOnly ? 'hidden lg:flex' : 'flex'} items-center gap-2 px-2.5 lg:px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                    isActive 
                      ? 'bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className="hidden lg:block w-4 h-4" aria-hidden="true" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </div>

          {/* --- RIGHT: Theme & Account Actions --- */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!toggleSidebar && (
              <button
                type="button"
                onClick={() => setMenuOpen(open => !open)}
                className="md:hidden p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-700/50"
                aria-label={menuOpen ? 'Close site menu' : 'Open site menu'}
                aria-expanded={menuOpen}
                aria-controls="mobile-site-menu"
              >
                {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-700/50"
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
                className="px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
          
        </div>
      </div>
      {!toggleSidebar && menuOpen && (
        <div id="mobile-site-menu" className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 grid gap-1" role="navigation" aria-label="Site menu">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = isActiveLink(link.path);
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base font-bold ${isActive ? 'bg-indigo-600/10 text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {link.name}
                </Link>
              );
            })}
            <Link to="/auth" className="mt-2 rounded-xl bg-indigo-600 px-4 py-3 text-center text-base font-bold text-white hover:bg-indigo-500">Create a free account</Link>
          </div>
        </div>
      )}
    </nav>
  );
}