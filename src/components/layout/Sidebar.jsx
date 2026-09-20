import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Globe2, KanbanSquare, Sparkles, Settings, LogOut, FileText, UserRound, BellRing, CreditCard, Users, Building2, Handshake, Inbox, UserCog, ShieldCheck, Crown } from 'lucide-react';
import {useAuth} from '../../context/session';

export default function Sidebar({ isOpen, setIsOpen }) {
  const navigate = useNavigate(); const { signOut, user } = useAuth();
  const menuItems = [
    { path:'/dashboard', name:'Global Feed', icon:Globe2 },
    {path:'/blog',name:'Blog',icon:FileText},
    {path:'/programs',name:'Degree Programs',icon:Globe2},
    { path:'/intelligence', name:'Watchlists', icon:BellRing },
    { path:'/notifications', name:'Notifications', icon:Inbox },
    { path:'/applications', name:'My Applications', icon:KanbanSquare },
    { path:'/copilot', name:'Application Studio', icon:Sparkles },
    { path:'/resume-builder', name:'Resume Studio', icon:FileText },
    { path:'/profiles', name:'My Profiles', icon:UserRound },
    { path:'/analytics', name:'Analytics', icon:Globe2 },
    { path:'/sponsored', name:'Sponsored Matches', icon:Handshake },
    { path:'/counselor-invites', name:'Counselor Invites', icon:Inbox },
    { path:'/counselor', name:'Counselor Workspace', icon:Users },
    { path:'/sponsor', name:'Sponsor Workspace', icon:Building2 },
    { path:'/pricing', name:'Plans & Billing', icon:CreditCard },
    { path:'/settings', name:'Settings', icon:Settings },
    { path:'/account', name:'Account & Data', icon:UserCog },
  ];
  const role = String(user?.app_metadata?.role || '').toLowerCase();
  if (['admin','staff'].includes(role)) menuItems.splice(menuItems.length - 2, 0, { path:'/quality', name:'Trust & Quality', icon:ShieldCheck });
  if (role === 'admin') menuItems.splice(menuItems.length - 2, 0, { path:'/admin', name:'Admin Control', icon:Crown });
  const logout=async()=>{await signOut();navigate('/');};
  return <aside className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[calc(100vw-1.5rem)] lg:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out pt-20 ${isOpen?'translate-x-0':'-translate-x-full lg:translate-x-0'}`}><div className="h-full px-4 py-4 flex flex-col overflow-y-auto"><ul className="space-y-1.5 flex-1">{menuItems.map(item=><li key={item.path}><NavLink to={item.path} onClick={()=>setIsOpen(false)} className={({isActive})=>`flex items-center p-2.5 rounded-xl font-medium text-sm transition-all ${isActive?'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400':'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'}`}><item.icon className="w-4.5 h-4.5 mr-3"/>{item.name}</NavLink></li>)}</ul><div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800"><button onClick={logout} className="w-full flex items-center p-3 rounded-xl font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><LogOut className="w-5 h-5 mr-3"/>Log Out</button></div></div></aside>;
}
