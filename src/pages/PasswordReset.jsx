import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { KeyRound, Mail, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext'; // <-- Added Auth Context

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const OTP_LENGTH = 6; 

export default function PasswordReset() {
  const { user } = useAuth(); // <-- Get current user status
  
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(new Array(OTP_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRefs = useRef([]);

  // Auto-skip to Step 3 if the user is already logged in (e.g., navigating from Settings)
  useEffect(() => {
    if (user) {
      setStep(3);
    }
  }, [user]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setStep(2);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const token = otp.join('');
    if (token.length !== OTP_LENGTH) return setError(`Please enter the full ${OTP_LENGTH}-digit code.`);
    
    setLoading(true); setError('');
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
      if (error) throw error;
      setStep(3);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      alert('Password successfully updated!');
      // Smart redirect: Go to settings if they were logged in, otherwise go to login
      window.location.href = user ? '/settings' : '/login';
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleOtpChange = (index, value) => {
    const val = value.replace(/[^0-9]/g, ''); // Numbers only
    if (val.length > 1) {
      // Handle paste
      const digits = val.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => { if (index + i < OTP_LENGTH) newOtp[index + i] = d; });
      setOtp(newOtp);
      const focusIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      otpRefs.current[focusIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    if (val && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-400">
            {step === 3 ? <Lock className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h1 className="text-xl font-extrabold text-white">
            {step === 1 ? 'Reset Password' : step === 2 ? 'Enter Code' : 'Set New Password'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {step === 1 ? 'Enter your email to receive a secure OTP.' 
             : step === 2 ? `We sent a ${OTP_LENGTH}-digit code to ${email}` 
             : 'Enter your new secure password below.'}
          </p>
        </div>

        {error && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium text-center">{error}</div>}

        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Send OTP
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="flex justify-center gap-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpRefs.current[idx] = el)}
                  type="text"
                  maxLength={OTP_LENGTH}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-10 h-12 text-center text-lg font-bold bg-slate-800 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              ))}
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Verify OTP
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password (min 6 chars)" className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}