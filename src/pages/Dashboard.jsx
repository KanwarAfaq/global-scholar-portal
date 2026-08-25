import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  Search, Sparkles, MapPin, Building2, Calendar, 
  DollarSign, ChevronRight, ChevronLeft, X, ExternalLink, Tag,
  UserCheck, Brain, Loader2, RefreshCw
} from 'lucide-react';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- REFINED VIBRANT BADGE STYLES ---
const getLevelBadgeStyle = (type = '') => {
  const normalized = type.toLowerCase();
  if (normalized.includes('phd') || normalized.includes('doctor')) {
    return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
  }
  if (normalized.includes('mphil')) {
    return 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30';
  }
  if (normalized.includes('master')) {
    return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
  }
  if (normalized.includes('bachelor') || normalized.includes('undergrad')) {
    return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  }
  if (normalized.includes('internship')) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
  if (normalized.includes('course') || normalized.includes('fellowship')) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
  return 'bg-slate-700/30 text-slate-300 border-slate-600/30';
};

const getCountryBadgeStyle = (country = '') => {
  const normalized = country.toLowerCase();
  if (normalized.includes('uk') || normalized.includes('united kingdom')) {
    return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  }
  if (normalized.includes('usa') || normalized.includes('united states')) {
    return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  }
  if (normalized.includes('canada')) {
    return 'bg-red-500/15 text-red-300 border-red-500/30';
  }
  if (normalized.includes('australia')) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
  if (normalized.includes('taiwan') || normalized.includes('japan') || normalized.includes('korea')) {
    return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
  }
  if (normalized.includes('europe') || normalized.includes('germany') || normalized.includes('switzerland') || normalized.includes('finland')) {
    return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
  }
  return 'bg-slate-800 text-slate-300 border-slate-700/50';
};

// --- EXPIRATION FILTER ---
const isOpportunityActive = (deadlineStr) => {
  if (!deadlineStr) return true;
  const lower = deadlineStr.toLowerCase();
  if (lower.includes('ongoing') || lower.includes('rolling') || lower.includes('open')) {
    return true;
  }
  
  const sanitized = deadlineStr.replace(/XX/gi, '28').trim();
  const parsedDate = new Date(sanitized);
  
  if (isNaN(parsedDate.getTime())) return true;
  
  const now = new Date();
  const GRACE_PERIOD_DAYS = 5;
  const expiryDate = new Date(parsedDate.getTime() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));
  
  return expiryDate >= now;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItem, setActiveItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [matchMyProfileOnly, setMatchMyProfileOnly] = useState(false);

  // AI Matchmaker States
  const [aiAnalysisMap, setAiAnalysisMap] = useState({});
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  // URL Parameters for Global Filtering
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('type') || 'All';
  const activeCountry = searchParams.get('country') || 'All';
  const activeField = searchParams.get('field') || 'All';

  const availableCountries = useMemo(() => {
    const countries = opportunities.map(o => o.country).filter(Boolean);
    return ['All', ...new Set(countries)].sort();
  }, [opportunities]);

  const availableFields = useMemo(() => {
    const fields = opportunities.map(o => o.field).filter(Boolean);
    return ['All', ...new Set(fields)].sort();
  }, [opportunities]);

  const availableTypes = useMemo(() => {
    const types = opportunities.map(o => o.type).filter(Boolean);
    return ['All', ...new Set(types)].sort();
  }, [opportunities]);

  useEffect(() => {
    fetchOpportunities();
    if (user) {
      fetchUserProfile();
      fetchUserSettings();
    }
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, activeCountry, activeField, matchMyProfileOnly]);

  async function fetchOpportunities() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('global_opportunities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOpportunities(data || []);
    } catch (err) {
      console.error('Error fetching data:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserProfile() {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
        
      if (data) setUserProfile(data);
    } catch (err) {
      console.log('No user profile found for custom filtering.');
    }
  }

  async function fetchUserSettings() {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) setUserSettings(data);
    } catch (err) {
      console.log('No user settings found.');
    }
  }

  // --- 4-TIER AI MATCHMAKER CALL with 40-Second Timeout Integration ---
  const handleGenerateAiAnalysis = async (opportunity) => {
    if (!opportunity) return;
    setAnalyzingAi(true);
    setAiError(null);

    const isDetailed = userSettings?.ai_summary_detail === 'detailed';

    const userContext = userProfile ? `
Candidate Name: ${userProfile.full_name || 'Candidate'}
Profile Alias: ${userProfile.profile_name || 'General'}
Bio & Experience: ${userProfile.bio || 'Not provided'}
Skills & Competencies: ${userProfile.skills || 'Not specified'}
` : 'No candidate profile attached. Analyze general suitability based on opportunity requirements.';

    const oppDetails = `
Title: ${opportunity.title}
Organization: ${opportunity.organization}
Level: ${opportunity.type}
Discipline: ${opportunity.field || 'General'}
Location: ${opportunity.country}
Funding: ${opportunity.funding_details || 'Not specified'}
Overview: ${opportunity.description || 'Not provided'}
Tags: ${(opportunity.tags || []).join(', ')}
`;

    const systemPrompt = isDetailed
      ? `You are an elite academic & career copilot. Perform a comprehensive match analysis evaluating the candidate against this opportunity.
Format your output with clear markdown headings:
### 🎯 Match Assessment (Give a percentage match rating e.g., 85% Fit)
### 🌟 Key Strengths & Synergy (2-3 tailored points on why the background fits)
### 💡 Application Strategy (Specific advice on what experiences to emphasize and how to address potential gaps)`
      : `You are an elite academic & career copilot. Evaluate this candidate against the opportunity and provide a concise, highly personalized 3-bullet fit summary.
Format strictly as 3 bullet points starting with actionable emojis (e.g., ✨, 🚀, 📌). Be direct, highlighting key alignment and one specific skill they should feature.`;

    const fullPrompt = `[OPPORTUNITY DETAILS]:\n${oppDetails}\n\n[CANDIDATE CONTEXT]:\n${userContext}`;
    let generatedText = "";

    // 🟢 TIER 1A: CGU Gateway (GPT-4o) with 40s Timeout
    try {
      console.log("Attempting CGU Gateway GPT-4o (Tier 1A) with 40s timeout...");
      const cguKey = import.meta.env.VITE_CGU_API_KEY;
      if (!cguKey) throw new Error("VITE_CGU_API_KEY is missing");

      const cguRes = await fetch('/cgullmapi/v1/chat/completions', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${cguKey}` 
        },
        body: JSON.stringify({ 
          model: "gpt-4o", 
          messages: [
            { role: "system", content: systemPrompt }, 
            { role: "user", content: fullPrompt }
          ]
        }),
        signal: AbortSignal.timeout(40000) // 40-second timeout limit
      });
      
      if (!cguRes.ok) throw new Error(await cguRes.text());
      generatedText = (await cguRes.json()).choices[0].message.content;

    } catch (err1a) {
      console.warn("CGU GPT-4o Failed or timed out after 40s, attempting CGU Local Model (Tier 1B)...", err1a.message);
      
      // 🟢 TIER 1B: CGU Local Model (gpt-oss:20b - Free Quota) with 40s Timeout
      try {
        const cguKey = import.meta.env.VITE_CGU_API_KEY;
        if (!cguKey) throw new Error("VITE_CGU_API_KEY is missing");

        const cguLocalRes = await fetch('https://air.cgu.edu.tw/cgullmapi/v1/chat/completions', {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${cguKey}` 
          },
          body: JSON.stringify({ 
            model: "gpt-oss:20b", 
            messages: [
              { role: "system", content: systemPrompt }, 
              { role: "user", content: fullPrompt }
            ]
          }),
          signal: AbortSignal.timeout(40000) // 40-second timeout limit
        });

        if (!cguLocalRes.ok) throw new Error(await cguLocalRes.text());
        generatedText = (await cguLocalRes.json()).choices[0].message.content;

      } catch (err1b) {
        console.warn("CGU Local Model Failed or timed out after 40s, attempting Groq (Tier 2)...", err1b.message);
        
        // 🟡 TIER 2: Groq Fallback with 40s Timeout
        try {
          const groqKey = import.meta.env.VITE_GROQ_API_KEY;
          if (!groqKey) throw new Error("VITE_GROQ_API_KEY is missing");

          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${groqKey}` 
            },
            body: JSON.stringify({ 
              model: "openai/gpt-oss-120b", 
              messages: [
                { role: "system", content: systemPrompt }, 
                { role: "user", content: fullPrompt }
              ]
            }),
            signal: AbortSignal.timeout(40000) // 40-second timeout limit
          });
          
          if (!groqRes.ok) throw new Error(await groqRes.text());
          generatedText = (await groqRes.json()).choices[0].message.content;

        } catch (err2) {
          console.warn("Groq Failed or timed out after 40s, attempting Gemini (Tier 3)...", err2.message);
          
          // 🟠 TIER 3: Gemini Fallback
          try {
            const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!geminiKey) throw new Error("VITE_GEMINI_API_KEY is missing");

            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const result = await model.generateContent(`${systemPrompt}\n\n${fullPrompt}`);
            generatedText = result.response.text();
          
          } catch (err3) {
            console.error("All AI tiers failed or timed out:", err3.message);
            setAiError("AI Generation failed or timed out across all networks. Please try again later.");
            setAnalyzingAi(false);
            return;
          }
        }
      }
    }

    setAiAnalysisMap(prev => ({
      ...prev,
      [opportunity.id]: generatedText
    }));
    setAnalyzingAi(false);
  };

  const handleSaveApplication = async (opportunity) => {
    if (!user) {
      alert("Please log in to save opportunities to your tracker!");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_applications')
        .insert([{ 
          opportunity_id: opportunity.id, 
          user_id: user.id,
          status: 'col-1' 
        }]);

      if (error) {
        if (error.code === '23505') throw new Error("You already saved this opportunity!");
        throw error;
      }
      
      alert('Successfully saved to your Kanban board! 📌');
      setActiveItem(null);
    } catch (err) {
      alert(err.message || 'Could not save application.');
    } finally {
      setSaving(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setSearchParams(prev => {
      if (value === 'All') prev.delete(key);
      else prev.set(key, value);
      return prev;
    });
  };

  // Filter Pipeline
  const filteredData = useMemo(() => {
    return opportunities.filter(item => {
      if (!isOpportunityActive(item.deadline)) return false;

      const matchesTab = activeTab === 'All' || item.type?.toLowerCase().includes(activeTab.toLowerCase());
      const matchesCountry = activeCountry === 'All' || item.country === activeCountry;
      const matchesField = activeField === 'All' || item.field === activeField;

      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        item.title?.toLowerCase().includes(searchLower) ||
        item.organization?.toLowerCase().includes(searchLower) ||
        item.country?.toLowerCase().includes(searchLower) ||
        item.field?.toLowerCase().includes(searchLower) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchLower)));

      let matchesProfile = true;
      if (matchMyProfileOnly && userProfile) {
        const userDomains = (userProfile.bio || '').toLowerCase() + ' ' + (userProfile.skills || '').toLowerCase();
        matchesProfile = 
          (item.field && userDomains.includes(item.field.toLowerCase())) ||
          (item.tags && item.tags.some(tag => userDomains.includes(tag.toLowerCase())));
      }

      return matchesTab && matchesCountry && matchesField && matchesSearch && matchesProfile;
    });
  }, [opportunities, activeTab, activeCountry, activeField, searchQuery, matchMyProfileOnly, userProfile]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  return (
    <div className="space-y-10 pb-12">
      
      {/* --- HERO BANNER --- */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/50 border border-slate-800/80 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 px-6 py-14 sm:px-12 sm:py-20 md:text-center flex flex-col md:items-center">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Global AI Scholarship Radar
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-6"
          >
            Discover Fully-Funded <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-teal-300">
              Global Opportunities
            </span>
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 p-2 rounded-2xl sm:rounded-full flex flex-col sm:flex-row gap-2 shadow-2xl"
          >
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by degree, discipline, university, country, or tags..." 
                className="w-full bg-transparent border-none text-white placeholder:text-slate-400 pl-12 pr-4 py-3 focus:outline-none focus:ring-0 text-sm sm:text-base"
              />
            </div>
            <button className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white px-8 py-3 rounded-xl sm:rounded-full font-bold text-sm transition-all shadow-lg shadow-indigo-600/30 flex justify-center items-center gap-2">
              Explore <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>

      {/* --- CONTROLS & FILTER SECTION --- */}
      <div className="flex flex-col space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Active Opportunities</h2>
            <span className="text-xs font-bold px-3 py-1 bg-indigo-500/15 rounded-full text-indigo-300 border border-indigo-500/30">
              {filteredData.length} Live Postings
            </span>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={activeField}
              onChange={(e) => handleFilterChange('field', e.target.value)}
              className="bg-slate-900/90 text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700/70 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              <option value="All">All Disciplines</option>
              {availableFields.filter(f => f !== 'All').map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>

            <select
              value={activeTab}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="bg-slate-900/90 text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700/70 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              <option value="All">All Levels</option>
              {availableTypes.filter(t => t !== 'All').map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select
              value={activeCountry}
              onChange={(e) => handleFilterChange('country', e.target.value)}
              className="bg-slate-900/90 text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700/70 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              <option value="All">All Countries</option>
              {availableCountries.filter(c => c !== 'All').map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>

            {userProfile && (
              <button
                onClick={() => setMatchMyProfileOnly(!matchMyProfileOnly)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  matchMyProfileOnly
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900/80 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4 text-indigo-400" />
                Match My Profile
              </button>
            )}
          </div>
        </div>

        {/* --- GRID FEED --- */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 animate-pulse h-64"></div>
            ))}
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/60 rounded-3xl border border-slate-800 backdrop-blur-md">
            <Sparkles className="w-10 h-10 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white">No active opportunities found</h3>
            <p className="text-slate-400 text-sm mt-1">
              Try broadening your filters or turning off profile matching.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedData.map((item) => (
              <motion.div
                layoutId={`card-${item.id}`}
                onClick={() => setActiveItem(item)}
                key={item.id}
                className="group relative flex flex-col justify-between p-6 h-full rounded-3xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:bg-slate-850 hover:border-indigo-500/40 hover:shadow-[0_12px_30px_rgba(99,102,241,0.15)] shadow-lg"
              >
                <div>
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getLevelBadgeStyle(item.type)}`}>
                      {item.type || 'Opportunity'}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full border flex items-center font-medium ${getCountryBadgeStyle(item.country)}`}>
                      <MapPin className="w-3 h-3 mr-1" /> {item.country || 'Global'}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white leading-snug mb-2 group-hover:text-indigo-200 transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-4 line-clamp-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" /> {item.organization}
                  </p>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {item.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300 bg-slate-800/90 rounded-md border border-slate-700/60">
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="px-2 py-0.5 text-[10px] text-slate-400 bg-slate-800/50 rounded-md border border-slate-700/40">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-800/80 mt-4 text-xs font-medium">
                  <p className="text-emerald-400 flex items-center truncate">
                    <DollarSign className="w-4 h-4 mr-1.5 shrink-0" />
                    <span className="truncate">{item.funding_details || 'Funding Unspecified'}</span>
                  </p>
                  <p className="text-amber-400 flex items-center">
                    <Calendar className="w-4 h-4 mr-1.5 shrink-0" />
                    <span>Deadline: {item.deadline || 'Ongoing'}</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* --- PAGINATION --- */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-400">
              Showing page <span className="text-white font-bold">{currentPage}</span> of{' '}
              <span className="text-white font-bold">{totalPages}</span>
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/60 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- DETAILED MODAL WITH LIVE AI MATCHMAKER --- */}
      <AnimatePresence>
        {activeItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveItem(null)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
            />
            
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <motion.div
                layoutId={`card-${activeItem.id}`}
                className="w-full max-w-2xl bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden pointer-events-auto border border-slate-800 flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-800 bg-slate-850/60 shrink-0 relative">
                  <button 
                    onClick={() => setActiveItem(null)}
                    className="absolute top-6 right-6 p-2 bg-slate-800 border border-slate-700 rounded-full text-slate-300 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border mb-3 ${getLevelBadgeStyle(activeItem.type)}`}>
                    {activeItem.type || 'Opportunity'}
                  </span>
                  <h2 className="text-2xl font-extrabold text-white pr-10 leading-tight">
                    {activeItem.title}
                  </h2>
                  <p className="text-slate-400 font-medium mt-3 flex items-center gap-1.5 text-sm">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    {activeItem.organization} • {activeItem.country}
                  </p>
                  
                  {activeItem.field && (
                    <p className="text-indigo-300 font-bold mt-1 text-sm">
                      Discipline: {activeItem.field}
                    </p>
                  )}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                  
                  {/* LIVE AI MATCHMAKER HERO BOX */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-purple-950/50 border border-indigo-500/30 relative overflow-hidden shadow-lg">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
                          <Brain className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-white">
                            AI Fit Assessment
                          </h4>
                          <p className="text-xs text-slate-400">
                            Evaluated against your active candidate profile.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleGenerateAiAnalysis(activeItem)}
                        disabled={analyzingAi}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 shrink-0"
                      >
                        {analyzingAi ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analyzing...
                          </>
                        ) : aiAnalysisMap[activeItem.id] ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Re-analyze
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Analyze Fit
                          </>
                        )}
                      </button>
                    </div>

                    {/* AI Output Content */}
                    {analyzingAi ? (
                      <div className="py-4 space-y-2.5 animate-pulse">
                        <div className="h-3 bg-indigo-500/20 rounded-full w-3/4"></div>
                        <div className="h-3 bg-indigo-500/10 rounded-full w-full"></div>
                        <div className="h-3 bg-indigo-500/15 rounded-full w-5/6"></div>
                      </div>
                    ) : aiError ? (
                      <p className="text-xs text-rose-400 mt-2 font-medium bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                        {aiError}
                      </p>
                    ) : aiAnalysisMap[activeItem.id] ? (
                      <div className="mt-3 pt-3 border-t border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line space-y-2">
                        {aiAnalysisMap[activeItem.id]}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1 italic">
                        Click "Analyze Fit" to get tailored feedback on alignment, key strengths, and application strategies.
                      </p>
                    )}
                  </div>

                  {/* Funding & Deadline cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Funding Details</p>
                      <p className="text-sm font-semibold text-emerald-400">{activeItem.funding_details || 'Not specified'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Application Deadline</p>
                      <p className="text-sm font-semibold text-amber-400">{activeItem.deadline || 'Ongoing'}</p>
                    </div>
                  </div>

                  {/* Description */}
                  {activeItem.description && (
                    <div>
                      <h4 className="text-sm font-bold text-white mb-2">Overview</h4>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                        {activeItem.description}
                      </p>
                    </div>
                  )}

                  {/* Focus Tags */}
                  {activeItem.tags && activeItem.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-indigo-400" /> Focus Areas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {activeItem.tags.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 shrink-0 bg-slate-850/60 flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => handleSaveApplication(activeItem)}
                    disabled={saving}
                    className="flex-1 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all disabled:opacity-50 border border-slate-700"
                  >
                    {saving ? 'Saving...' : 'Save to My Applications'}
                  </button>
                  
                  <a
                    href={activeItem.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30"
                  >
                    Apply Now <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}