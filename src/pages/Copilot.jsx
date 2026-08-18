import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Sparkles, FileText, Send, Building2, MapPin, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Initialize Supabase & Gemini
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export default function Copilot() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  
  // AI State
  const [generating, setGenerating] = useState(false);
  const [resultText, setResultText] = useState('');
  const [copied, setCopied] = useState(false);
  const [promptType, setPromptType] = useState('cover_letter');

  useEffect(() => {
    fetchSavedApplications();
    if (user) {
      fetchUserProfiles();
    }
  }, [user]);

  async function fetchUserProfiles() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id);
        
      if (data && data.length > 0) {
        setProfiles(data);
        setSelectedProfileId(data[0].id); // Auto-select the first one
      }
    } catch (err) {
      console.error('Error fetching profiles:', err.message);
    }
  }

  async function fetchSavedApplications() {
    setLoadingApps(true);
    try {
      const { data, error } = await supabase
        .from('user_applications')
        .select('id, status, global_opportunities(*)');

      if (error) throw error;
      
      const formattedApps = data
        .filter(app => app.global_opportunities)
        .map(app => ({
          appId: app.id,
          status: app.status,
          ...app.global_opportunities
        }));

      setApplications(formattedApps);
      if (formattedApps.length > 0) setSelectedApp(formattedApps[0]);
    } catch (err) {
      console.error('Error fetching applications:', err.message);
    } finally {
      setLoadingApps(false);
    }
  }

  const handleGenerate = async () => {
    if (!selectedApp) return;
    setGenerating(true);
    setResultText('');
    setCopied(false);

    const activeProfile = profiles.find(p => p.id === selectedProfileId);

    const systemPrompt = `You are an expert career and academic advisor. 
    The user's name is ${activeProfile?.full_name || 'the applicant'}.
    Their professional background: ${activeProfile?.bio || 'Not specified'}.
    Their core skills/certifications: ${activeProfile?.skills || 'Not specified'}.

    They are applying for a ${selectedApp.type} position titled "${selectedApp.title}" at "${selectedApp.organization}" in ${selectedApp.country}. 
    ${selectedApp.description ? `Job description: ${selectedApp.description}` : ''}
    ${selectedApp.tags ? `Key requirements: ${selectedApp.tags.join(', ')}` : ''}
    
    CRITICAL INSTRUCTION: Seamlessly weave the user's background and skills into the application to prove they are the perfect fit. Do not use placeholders like [Your Name], use the provided name.`;

    const userPrompt = promptType === 'cover_letter' 
      ? "Write a professional, modern, and highly tailored cover letter for this opportunity. Keep it concise (under 300 words), engaging, and ready to be customized with the user's specific background."
      : "Write a short, compelling cold email to a professor or hiring manager regarding this opportunity. Include a catchy subject line. Keep it under 150 words.";

    try {
      // 🟢 PRIMARY: Gemini API 
      console.log("Attempting generation with Primary API (Gemini)...");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(`${systemPrompt}\n\nTask: ${userPrompt}`);
      const response = await result.response;
      setResultText(response.text());

    } catch (primaryError) {
      console.warn("⚠️ Gemini failed. Routing to Groq fallback...", primaryError);
      
      try {
        // 🟡 SECONDARY: Groq API 
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Task: ${userPrompt}` }
            ]
          })
        });

        if (!groqResponse.ok) {
          const errorBody = await groqResponse.text();
          throw new Error(`Groq API Error (${groqResponse.status}): ${errorBody}`);
        }
        
        const data = await groqResponse.json();
        setResultText(data.choices[0].message.content);
        console.log("✅ Successfully generated using Groq fallback.");

      } catch (fallbackError) {
        console.error("❌ Both Primary and Fallback APIs failed:", fallbackError);
        setResultText("We are currently experiencing issues with our AI providers. Please check your API keys or try again in a few moments.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 pb-10">
      
      {/* Left Sidebar: Application Selection */}
      <div className="w-full md:w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shrink-0 shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            Select Application
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none">
          {loadingApps ? (
            <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : applications.length === 0 ? (
            <p className="text-sm text-slate-500 text-center p-4">No saved applications found. Go to the dashboard to save some!</p>
          ) : (
            applications.map(app => (
              <button
                key={app.appId}
                onClick={() => setSelectedApp(app)}
                className={`w-full text-left p-4 rounded-2xl transition-all ${
                  selectedApp?.appId === app.appId 
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 border' 
                    : 'bg-transparent border-transparent border hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1 block">
                  {app.type}
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1 mb-1">{app.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {app.organization}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Content: AI Generation Workspace */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {selectedApp ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{selectedApp.title}</h1>
              <div className="flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {selectedApp.organization}</span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {selectedApp.country}</span>
              </div>
            </div>

            {/* AI Controls */}
            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl">
                <button 
                  onClick={() => setPromptType('cover_letter')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${promptType === 'cover_letter' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Cover Letter
                </button>
                <button 
                  onClick={() => setPromptType('cold_email')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${promptType === 'cold_email' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Cold Email
                </button>
              </div>
{/* Profile Selector Dropdown */}
              {profiles.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:block">Using Profile:</span>
                  <select 
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                  >
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.profile_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button 
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Drafting...' : 'Generate Draft'}
              </button>
            </div>

            {/* AI Output Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 dark:bg-[#0B0F19]/50 relative">
              {resultText ? (
                <div className="max-w-3xl mx-auto group">
                  <div className="flex justify-end mb-2 sticky top-0">
                    <button 
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-sm font-medium"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy to clipboard'}
                    </button>
                  </div>
                  <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {resultText}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                  <Send className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-medium">Select an application and click generate to draft your content.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium text-lg">Your AI Copilot is ready</p>
            <p className="text-sm mt-1">Select an application from the left to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}