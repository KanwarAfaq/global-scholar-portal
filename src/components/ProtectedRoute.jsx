import React from 'react';
import { Navigate } from 'react-router-dom';
import {useAuth} from '../context/session';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  if (roles?.length) {
    const role = String(user?.app_metadata?.role || 'user').toLowerCase();
    if (!roles.includes(role)) {
      return <div className="max-w-2xl mx-auto mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6"><ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400"/><h1 className="mt-3 text-xl font-black text-slate-950 dark:text-white">Restricted area</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Your account does not have permission to access this workspace.</p></div>;
    }
  }
  return children;
}
