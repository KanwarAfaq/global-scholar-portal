import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  Sparkles, FileText, Building2, MapPin, Loader2, 
  Copy, CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Copilot() {
  const { user } = useAuth();
  
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  
  // Generation & Mode States
  const [generating, setGenerating] = useState(false);
  const [resultText, setResultText] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Default to cover letter since Resume was moved to a separate tool
  const [promptType, setPromptType] = useState('cover_letter'); 

  useEffect(() => {
    fetchSavedApplications();
    if (user) fetchUserProfiles();
  }, [user]);

  async function fetchUserProfiles() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id);
        
      if (data && data.length > 0) {
        setProfiles(data);
        setSelectedProfileId(data[0].id);
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

  const activeProfile = profiles.find(p => p.id === selectedProfileId);

  // 3-Tier AI Generator for Cover Letters & Emails
  const handleGenerate = async () => {
    if (!selectedApp) return;
    setGenerating(true);
    setResultText('');
    setCopied(false);

    const systemPrompt = `You are an elite career strategist.
Candidate Name: ${activeProfile?.full_name || 'Candidate'}
Email: ${user?.email || 'email@example.com'}
Candidate Bio & Background: ${activeProfile?.bio || 'Not specified'}
Candidate Skills: ${activeProfile?.skills || 'Not specified'}

Target Position: ${selectedApp.title}
Target Organization: ${selectedApp.organization} (${selectedApp.country})
Target Degree/Type: ${selectedApp.type}
Description: ${selectedApp.description || ''}
Key Requirements/Tags: ${(selectedApp.tags || []).join(', ')}`;

    let userPrompt = "";
    if (promptType === 'cover_letter') {
      userPrompt = `Write a professional, compelling cover letter (under 300 words) tailored to ${selectedApp.title} at ${selectedApp.organization}.`;
    } else {
      userPrompt = `Write a short, engaging cold email (under 150 words) to the hiring committee or professor for ${selectedApp.title}. Include a subject line.`;
    }

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    let finalOutput = "";

    try {
      // 🟢 TIER 1: CGU Institutional Gateway (GPT-4o)
      console.log("Attempting CGU Gateway (Tier 1)...");
      const cguKey = import.meta.env.VITE_CGU_API_KEY;
      if (!cguKey) throw new Error("VITE_CGU_API_KEY is missing");

      const cguRes = await fetch('https://air.cgu.edu.tw/cgullmapi/v1/chat/completions', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${cguKey}` 
        },
        body: JSON.stringify({ 
          model: "gpt-4o", 
          messages: [
            { role: "system", content: "You are an expert career writer. Output clean text without markdown code blocks." }, 
            { role: "user", content: fullPrompt }
          ]
        })
      });
      
      if (!cguRes.ok) throw new Error(await cguRes.text());
      finalOutput = (await cguRes.json()).choices[0].message.content;

    } catch (err1) {
      console.warn("CGU Gateway Failed:", err1.message);
      try {
        // 🟡 TIER 2: Groq Fallback
        console.log("Attempting Groq AI (Tier 2)...");
        const groqKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!groqKey) throw new Error("VITE_GROQ_API_KEY is missing");

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${groqKey}` 
          },
          body: JSON.stringify({ 
            model: "openai/gpt-oss-20b", 
            messages: [
              { role: "system", content: "You are an expert career writer. Output clean text without markdown code blocks." }, 
              { role: "user", content: fullPrompt }
            ]
          })
        });
        
        if (!groqRes.ok) throw new Error(await groqRes.text());
        finalOutput = (await groqRes.json()).choices[0].message.content;

      } catch (err2) {
        console.warn("Groq Failed:", err2.message);
        try {
          // 🟠 TIER 3: Gemini Fallback
          console.log("Attempting Gemini AI (Tier 3)...");
          const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
          if (!geminiKey) throw new Error("VITE_GEMINI_API_KEY is missing");

          const genAI = new GoogleGenerativeAI(geminiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
          const result = await model.generateContent(fullPrompt);
          finalOutput = result.response.text();
        
        } catch (err3) {
          console.error("All APIs failed:", err3.message);
          finalOutput = "AI Generation failed across all networks. Please try again later.";
        }
      }
    }

    setResultText(finalOutput);
    setGenerating(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 pb-10">
      
      {/* 📱 Left Sidebar: Application Selection */}
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
            <p className="text-sm text-slate-500 text-center p-4">No saved applications found.</p>
          ) : (
            applications.map(app => (
              <button
                key={app.appId}
                onClick={() => { setSelectedApp(app); setResultText(''); }}
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

      {/* 🖥️ Right Content Workspace */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {selectedApp ? (
          <>
            {/* Header Info */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">{selectedApp.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {selectedApp.organization}</span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {selectedApp.country}</span>
              </div>
            </div>

            {/* Controls Toolbar */}
            <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* Mode Toggles */}
                <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
                  <button 
                    onClick={() => setPromptType('cover_letter')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${promptType === 'cover_letter' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Cover Letter
                  </button>
                  <button 
                    onClick={() => setPromptType('cold_email')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${promptType === 'cold_email' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Cold Email
                  </button>
                </div>

                {/* Profile & Generate Actions */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {profiles.length > 0 && (
                    <select 
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      className="flex-1 sm:flex-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl py-2 px-3 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                    >
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name}</option>)}
                    </select>
                  )}
                  
                  <button 
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20 whitespace-nowrap"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? 'Drafting...' : 'Generate'}
                  </button>
                </div>
              </div>
            </div>

            {/* Output Display Area */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50/30 dark:bg-[#0B0F19]/50 relative">
              {resultText ? (
                <div className="max-w-3xl mx-auto group">
                  <div className="flex justify-end gap-2 mb-4 sticky top-0 bg-slate-50/80 dark:bg-[#0B0F19]/80 backdrop-blur-sm p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm z-10">
                    <button 
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-sm font-medium"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy Text'}
                    </button>
                  </div>
                  <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {resultText}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center px-4">
                  <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-medium">Select a profile and click generate to draft your content.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center px-4">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium text-lg">Select an application from the left to start drafting.</p>
          </div>
        )}
      </div>

    </div>
  );
}