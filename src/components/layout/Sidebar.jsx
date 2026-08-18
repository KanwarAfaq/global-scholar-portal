import React from 'react';
import { NavLink } from 'react-router-dom';
import { Globe2, KanbanSquare, Sparkles, Settings } from 'lucide-react';

export default function Sidebar({ isOpen, setIsOpen }) {
  const menuItems = [
    { path: '/', name: 'Global Feed', icon: Globe2 },
    { path: '/applications', name: 'My Applications', icon: KanbanSquare },
    { path: '/copilot', name: 'AI Copilot', icon: Sparkles },
    { path: '/settings', name: 'Settings', icon: Settings },
    { path: '/analytics', name: 'Analytics', icon: Globe2 },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out pt-20 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="h-full px-4 py-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                onClick={() => setIsOpen(false)} // Close on mobile after click
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
      </div>
    </aside>
  );
}