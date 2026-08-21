import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Globe2, KanbanSquare, Sparkles, Settings, LogOut, FileText, PointerOffIcon } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- Initialize Supabase directly ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Sidebar({ isOpen, setIsOpen }) {
  const navigate = useNavigate();

  const menuItems = [
    { path: '/dashboard', name: 'Global Feed', icon: Globe2 }, 
    { path: '/applications', name: 'My Applications', icon: KanbanSquare },
    { path: '/copilot', name: 'AI Copilot', icon: Sparkles },
    { path: '/settings', name: 'Settings', icon: Settings },
    { path: '/analytics', name: 'Analytics', icon: Globe2 },
    { path: '/resume-builder', name: 'Resume Studio', icon: FileText },
    { path: '/profiles', name: 'My Profiles', icon: PointerOffIcon },
  ];

  const handleLogout = async () => {
    try {
      // Directly log out using Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Force navigation to login and reload to clear React state
      navigate('/'); 
      window.location.reload(); 
    } catch (error) {
      console.error('Error logging out:', error.message);
      alert('Failed to log out. Please check your connection.');
    }
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out pt-20 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="h-full px-4 py-4 flex flex-col overflow-y-auto">
        
        {/* Navigation Links */}
        <ul className="space-y-2 flex-1">
          {menuItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                onClick={() => setIsOpen(false)} 
                className={({ isActive }) =>
                  `flex items-center p-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Logout Button */}
        <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center p-3 rounded-xl font-medium transition-all duration-200 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Log Out
          </button>
        </div>

      </div>
    </aside>
  );
}