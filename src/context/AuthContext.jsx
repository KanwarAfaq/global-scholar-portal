import {invokeFunction} from '../lib/functions';
import React, { useEffect, useState } from 'react';
import {supabase} from '../lib/supabase';
import {AuthContext} from './session';
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setLoading(false); });
    return () => subscription.unsubscribe();
  }, []);
  const signUp = (email, password) => supabase.auth.signUp({ email, password });
  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signOut = () => supabase.auth.signOut();
  const requestOtp = async (email, purpose='login') => {
    return invokeFunction('otp-request', { body: { email, purpose } });
  };
  const verifyOtp = async (email, code, purpose='login') => {
    const data = await invokeFunction('otp-verify', { body: { email, code, purpose } });
    if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error('Secure session was not returned');
    const { error: setError } = await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    if (setError) throw setError; return data;
  };
  return <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, requestOtp, verifyOtp }}>{children}</AuthContext.Provider>;
}
