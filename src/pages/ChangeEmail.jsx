import React, { useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../context/AuthContext';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const OTP_LENGTH = 6; // Change to 4 if your Supabase project is configured for 4-digit OTPs

export default function ChangeEmail() {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: New Email, 2: OTP
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState(new Array(OTP_LENGTH).fill(''));
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRefs = useRef([]);

  const handleRequestChange = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
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
      const { error } = await supabase.auth.verifyOtp({ email: newEmail, token, type: 'email_change' });
      if (error) throw error;
      alert('Email successfully updated!');
      window.location.href = '/settings';
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleOtpChange = (index, value) => {
    const val = value.replace(/[^0-9]/g, ''); // Numbers only
    if (val.length > 1) {
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
            {step === 1 ? <Mail className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <h1 className="text-xl font-extrabold text-white">Change Email</h1>
          <p className="text-xs text-slate-400 mt-1">
            {step === 1 ? `Current: ${user?.email}` : `Enter the code sent to ${newEmail}`}
          </p>
        </div>

        {error && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium text-center">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleRequestChange} className="space-y-4">
            <div>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-500" />
                <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new-email@example.com" className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Send Verification Code
            </button>
          </form>
        ) : (
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
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Confirm New Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}