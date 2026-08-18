import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Activity, Target, TrendingUp, Calendar, Loader2 } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

const STATUS_COLORS = {
  'col-1': '#94a3b8', // Saved (Slate)
  'col-2': '#fbbf24', // Preparing (Amber)
  'col-3': '#3b82f6', // Applied (Blue)
  'col-4': '#a855f7', // Interview (Purple)
  'col-5': '#10b981', // Offer (Emerald)
};

const STATUS_LABELS = {
  'col-1': 'Saved',
  'col-2': 'Preparing',
  'col-3': 'Applied',
  'col-4': 'Interviewing',
  'col-5': 'Offers',
};

export default function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    successRate: 0,
    funnelData: [],
    deadlines: []
  });

  useEffect(() => {
    if (user) fetchAnalytics();
  }, [user]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_applications')
        .select('id, status, global_opportunities(title, organization, deadline)')
        .eq('user_id', user.id);

      if (error) throw error;

      // Calculate Metrics
      const total = data.length;
      const offers = data.filter(app => app.status === 'col-5').length;
      const active = data.filter(app => ['col-2', 'col-3', 'col-4'].includes(app.status)).length;
      const successRate = total > 0 ? Math.round((offers / data.filter(app => app.status !== 'col-1').length) * 100) || 0 : 0;

      // Group Data for Charts
      const statusCounts = data.reduce((acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {});

      const funnelData = Object.keys(STATUS_LABELS).map(key => ({
        name: STATUS_LABELS[key],
        value: statusCounts[key] || 0,
        color: STATUS_COLORS[key]
      }));

      // Extract Upcoming Deadlines
      const deadlines = data
        .filter(app => app.global_opportunities?.deadline && app.status !== 'col-5')
        .map(app => ({
          id: app.id,
          title: app.global_opportunities.title,
          org: app.global_opportunities.organization,
          date: new Date(app.global_opportunities.deadline)
        }))
        .filter(app => app.date >= new Date()) // Only future deadlines
        .sort((a, b) => a.date - b.date)
        .slice(0, 5); // Top 5 closest

      setStats({ total, active, successRate, funnelData, deadlines });
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Analytics Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Track your conversion rates and upcoming milestones.</p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Tracked</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Active Applications</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.active}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Offer Rate</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.successRate}%</p>
          </div>
        </div>
      </div>

      {/* Charts & Deadlines Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Application Funnel Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6">Application Pipeline</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.funnelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stats.funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Deadlines Widget */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-500" /> Upcoming Deadlines
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-none">
            {stats.deadlines.length === 0 ? (
              <p className="text-sm text-slate-500 text-center mt-10">No upcoming deadlines detected in your active applications.</p>
            ) : (
              stats.deadlines.map(app => (
                <div key={app.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1">
                    {app.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{app.title}</h4>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{app.org}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}