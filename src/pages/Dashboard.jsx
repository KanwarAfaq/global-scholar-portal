import {useEffectEvent} from 'react';
import {supabase} from '../lib/supabase';
import { notify } from '../lib/notify';
import { activeProfileId, selectProfile } from '../lib/profile';
import OpportunityFacts, { CountryLabel, InstitutionMark } from '../components/OpportunityFacts';
import { officialUrl } from '../lib/opportunities';
import React, { useState, useEffect, useMemo } from 'react';
import {useAuth} from '../context/session';
import { runAiAction } from '../lib/ai';
import { track } from '../lib/analytics';
import Engagement from '../components/Engagement';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams,useNavigate } from 'react-router-dom';
import { 
  Search, Sparkles, Building2, Calendar, 
  DollarSign, ChevronRight, ChevronLeft, X, ExternalLink, Tag,
  UserCheck, Brain, Loader2, RefreshCw, BookOpen, Bell 
} from 'lucide-react';

// Initialize Supabase


// --- REFINED VIBRANT BADGE STYLES ---
const getLevelBadgeStyle = (type = '') => {
  const normalized = type.toLowerCase();
  if (normalized.includes('phd') || normalized.includes('doctor')) {
    return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30';
  }
  if (normalized.includes('mphil')) {
    return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-500/30';
  }
  if (normalized.includes('master')) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30';
  }
  if (normalized.includes('bachelor') || normalized.includes('undergrad')) {
    return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30';
  }
  if (normalized.includes('internship')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
  }
  if (normalized.includes('course') || normalized.includes('fellowship')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-600/30';
};

const getCountryBadgeStyle = (country = '') => {
  const normalized = country.toLowerCase();
  if (normalized.includes('uk') || normalized.includes('united kingdom')) {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30';
  }
  if (normalized.includes('usa') || normalized.includes('united states')) {
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
  }
  if (normalized.includes('canada')) {
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30';
  }
  if (normalized.includes('australia')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
  }
  if (normalized.includes('taiwan') || normalized.includes('japan') || normalized.includes('korea')) {
    return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30';
  }
  if (normalized.includes('europe') || normalized.includes('germany') || normalized.includes('switzerland') || normalized.includes('finland')) {
    return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/50';
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
  const [profiles,setProfiles]=useState([]);const [fitScores,setFitScores]=useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItem, setActiveItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
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

  const effectLoad=useEffectEvent(()=>{fetchOpportunities();if(user)fetchUserProfile();});
  useEffect(() => {
    effectLoad();
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
    const {data,error}=await supabase.from('user_profiles').select('*').eq('user_id',user.id).order('updated_at',{ascending:false});
    if(error){setAiError(error.message);return;}
    setProfiles(data||[]);setUserProfile((data||[]).find(x=>x.id===activeProfileId(user.id))||data?.[0]||null);
  }
  useEffect(()=>{
    let cancelled=false;setAiAnalysisMap({});setFitScores({});
    if(user?.id&&userProfile?.id){
      supabase.from('user_match_scores').select('*').eq('user_id',user.id).eq('profile_id',userProfile.id).then(({data,error})=>{
        if(cancelled)return;if(error){setAiError(error.message);return;}
        const map={},scores={};for(const row of data||[]){const stale=row.assessment_version!=='evidence-v2'||new Date(row.calculated_at)<new Date(userProfile.updated_at);map[row.opportunity_id]=`${stale?'Profile or assessment rules changed — analyze again.\n':''}Fit score: ${row.score}%\nEligibility: ${row.eligible===false?'Potential conflict':row.eligible===true?'Published checks met':'Needs confirmation'}\n\n${row.explanation||''}`;scores[row.opportunity_id]=stale?null:row.score;}
        setAiAnalysisMap(map);setFitScores(scores);
      });
    }
    return()=>{cancelled=true;};
  },[user?.id,userProfile?.id,userProfile?.updated_at]);

  // Protected server-side AI matching. Provider keys never reach the browser.
  const handleGenerateAiAnalysis = async (opportunity) => {
    if (!opportunity) return;
    if (!user) { navigate('/auth'); return; }
    if(!userProfile){setAiError('Select a candidate profile first.');return;}
    setAnalyzingAi(true);
    setAiError(null);
    try {
      const result = await runAiAction('match', { profileId: userProfile?.id, opportunityId: opportunity.id });
      const deterministic = result.deterministic;
      setFitScores(prev=>({...prev,[opportunity.id]:deterministic?.score}));
      const prefix = deterministic ? `Fit score: ${deterministic.score}%\nEligibility: ${deterministic.eligible === false ? 'Potential hard-rule conflict' : 'No confirmed hard-rule conflict'}\n\n` : '';
      setAiAnalysisMap(prev => ({ ...prev, [opportunity.id]: prefix + result.text }));
      track('match_analysis_generated', { userId: user.id, entityType: 'opportunity', entityId: opportunity.id, properties: { score: deterministic?.score, provider: result.provider } });
    } catch (err) {
      setAiError(err.code === 'quota_exceeded' ? 'Your AI allowance is used. Upgrade from Plans & Billing to continue.' : (err.message || 'AI analysis failed.'));
    } finally {
      setAnalyzingAi(false);
    }
  };

  const handleWatchOpportunity = async (opportunity) => {
    if (!user) { navigate('/auth'); return; }
    try {
      const { error } = await supabase.from('user_watchlists').upsert({ user_id: user.id, opportunity_id: opportunity.id, notify_changes: true, notify_deadline: true }, { onConflict: 'user_id,opportunity_id' });
      if (error) throw error;
      track('watchlist_added', { userId: user.id, entityType: 'opportunity', entityId: opportunity.id });
      notify('Added to Opportunity Intelligence watchlist.');
    } catch (err) { notify(err.message || 'Could not add watchlist.'); }
  };

  const handleSaveApplication = async (opportunity) => {
    if (!user) {
      notify("Please log in to save opportunities to your tracker!");
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
      
      notify('Successfully saved to your Kanban board! 📌');
      setActiveItem(null);
    } catch (err) {
      notify(err.message || 'Could not save application.');
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
        const userDomains = [userProfile.bio, userProfile.skills, userProfile.technical_skills, userProfile.research_interests].map(v => Array.isArray(v) ? JSON.stringify(v) : (v || '')).join(' ').toLowerCase();
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
      {user&&<label className="block mb-5 text-sm font-semibold">Active candidate profile<select aria-label="Active candidate profile" className="admin-input block w-full sm:max-w-md mt-2" value={userProfile?.id||''} onChange={e=>{const profile=profiles.find(x=>x.id===e.target.value);setUserProfile(profile||null);selectProfile(user.id,e.target.value);}}><option value="">Select profile</option>{profiles.map(x=><option key={x.id} value={x.id}>{x.profile_name}</option>)}</select></label>}

      
      {/* --- HERO BANNER --- */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/50 border border-slate-200/80 dark:border-slate-800/80 shadow-2xl backdrop-blur-2xl">
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
            Discover Your Next <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-teal-300">
              Global Opportunity
            </span>
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-300/60 dark:border-slate-700/60 p-2 rounded-2xl sm:rounded-full flex flex-col sm:flex-row gap-2 shadow-2xl"
          >
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-slate-600 dark:text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by degree, discipline, university, country, or tags..." 
                className="w-full bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 pl-12 pr-4 py-3 focus:outline-none focus:ring-0 text-sm sm:text-base"
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
          
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <h2 className="whitespace-nowrap text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Active Opportunities</h2>
            <span className="text-xs font-bold px-3 py-1 bg-indigo-500/15 rounded-full text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
              {filteredData.length} Live Postings
            </span>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={activeField}
              onChange={(e) => handleFilterChange('field', e.target.value)}
              className="bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-300/70 dark:border-slate-700/70 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              <option value="All">All Disciplines</option>
              {availableFields.filter(f => f !== 'All').map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>

            <select
              value={activeTab}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-300/70 dark:border-slate-700/70 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              <option value="All">All Levels</option>
              {availableTypes.filter(t => t !== 'All').map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select
              value={activeCountry}
              onChange={(e) => handleFilterChange('country', e.target.value)}
              className="bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-300/70 dark:border-slate-700/70 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
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
                    : 'bg-white dark:bg-slate-900/80 border-slate-300 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
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
              <div key={i} className="bg-white/60 dark:bg-slate-900/60 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 animate-pulse h-64"></div>
            ))}
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="text-center py-20 bg-white/60 dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 backdrop-blur-md">
            <Sparkles className="w-10 h-10 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No active opportunities found</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
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
                className="group relative flex flex-col justify-between p-6 h-full rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:bg-slate-850 hover:border-indigo-500/40 hover:shadow-[0_12px_30px_rgba(99,102,241,0.15)] shadow-lg"
              >
                <div>
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getLevelBadgeStyle(item.type)}`}>
                      {item.type || 'Opportunity'}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full border flex items-center font-medium ${getCountryBadgeStyle(item.country)}`}>
                      <CountryLabel country={item.country}/>
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug mb-2 group-hover:text-indigo-700 dark:group-hover:text-indigo-200 transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-4 line-clamp-1">
                    <InstitutionMark item={item}/> {item.organization}
                  </p>

                  <OpportunityFacts item={item} score={fitScores[item.id]}/>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {item.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800/90 rounded-md border border-slate-300/60 dark:border-slate-700/60">
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 rounded-md border border-slate-300/40 dark:border-slate-700/40">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 mt-4 text-xs font-medium">
                  <p className="text-emerald-700 dark:text-emerald-400 flex items-center truncate">
                    <DollarSign className="w-4 h-4 mr-1.5 shrink-0" />
                    <span className="truncate">{item.funding_details || 'Funding Unspecified'}</span>
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 flex items-center">
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
          <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Showing page <span className="text-slate-900 dark:text-white font-bold">{currentPage}</span> of{' '}
              <span className="text-slate-900 dark:text-white font-bold">{totalPages}</span>
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden pointer-events-auto border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-850/60 shrink-0 relative">
                  <button 
                    onClick={() => setActiveItem(null)}
                    className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-slate-700 dark:text-slate-300 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border mb-3 ${getLevelBadgeStyle(activeItem.type)}`}>
                    {activeItem.type || 'Opportunity'}
                  </span>
                  {activeItem.verified && (
                    <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border mb-3 bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                      <UserCheck className="w-3.5 h-3.5" /> Verified {activeItem.verified_at ? new Date(activeItem.verified_at).toLocaleDateString() : ''}
                    </span>
                  )}
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white pr-10 leading-tight">
                    {activeItem.title}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 font-medium mt-3 flex items-center gap-1.5 text-sm">
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
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/70 dark:via-slate-900 dark:to-purple-950/50 border border-indigo-500/30 relative overflow-hidden shadow-lg">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
                          <Brain className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            AI Fit Assessment
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Profile: {userProfile?.profile_name || 'Select a profile'}.
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
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line space-y-2">
                        {aiAnalysisMap[activeItem.id]}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                        Click "Analyze Fit" to get tailored feedback on alignment, key strengths, and application strategies.
                      </p>
                    )}
                  </div>

                  {/* Funding & Deadline cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700/60">
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Funding Details</p>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{activeItem.funding_details || 'Not specified'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700/60">
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Application Deadline</p>
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{activeItem.deadline || 'Ongoing'}</p>
                    </div>
                  </div>

                  {/* Description */}
                  {activeItem.description && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Overview</h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                        {activeItem.description}
                      </p>
                    </div>
                  )}

                  {/* Focus Tags */}
                  {activeItem.tags && activeItem.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
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
                  <Engagement contentType="opportunity" contentId={activeItem.id} />
                </div>

                {/* Footer */}
<div className="p-6 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-850/60 flex flex-col gap-3">
  {/* Primary Actions Row */}
  <div className="flex flex-col sm:flex-row gap-3">
    <button 
      onClick={() => handleSaveApplication(activeItem)}
      disabled={saving}
      className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs transition-all disabled:opacity-50 border border-slate-300 dark:border-slate-700"
    >
      {saving ? 'Saving...' : 'Save to My Applications'}
    </button>
    
    <a
      href={officialUrl(activeItem)||undefined} aria-disabled={!officialUrl(activeItem)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30"
    >
      Apply Now <ExternalLink className="w-4 h-4" />
    </a>
  </div>

  <button
    onClick={() => handleWatchOpportunity(activeItem)}
    className="w-full py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/20 transition-all flex justify-center items-center gap-2"
  >
    <Bell className="w-4 h-4" /> Watch for Changes & Deadline Alerts
  </button>

  {/* Secondary Action: Read Blog */}
  <button
    onClick={() => navigate(`/opportunity/${activeItem.id}/blog`)}
    className="w-full py-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/20 transition-all flex justify-center items-center gap-2"
  >
    <BookOpen className="w-4 h-4" /> Read AI Deep Dive
  </button>
</div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
