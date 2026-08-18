import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, Sparkles, MapPin, Building2, Calendar, 
  DollarSign, ChevronRight, X, ExternalLink, Tag
} from 'lucide-react';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Dashboard() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItem, setActiveItem] = useState(null); // Controls the modal
const { user } = useAuth();
  // URL Parameters for Global Filtering
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('type') || 'All';
  const activeCountry = searchParams.get('country') || 'All';

  const categories = ['All', 'Bachelor', 'Master', 'PhD', 'Internship', 'Course'];

  useEffect(() => {
    fetchOpportunities();
  }, []);

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
  // Update URL when clicking quick-filter tabs in Dashboard
  const handleTabClick = (cat) => {
    setSearchParams(prev => {
      if (cat === 'All') prev.delete('type');
      else prev.set('type', cat);
      return prev;
    });
  };

  // Filter Logic applying Type, Country (from Navbar), and Search Query
  const filteredData = opportunities.filter(item => {
    const matchesTab = activeTab === 'All' || item.type === activeTab;
    const matchesCountry = activeCountry === 'All' || item.country === activeCountry;
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      item.title?.toLowerCase().includes(searchLower) ||
      item.organization?.toLowerCase().includes(searchLower) ||
      item.country?.toLowerCase().includes(searchLower) ||
      (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchLower)));
    
    return matchesTab && matchesCountry && matchesSearch;
  });

  return (
    <div className="space-y-12 pb-10">
      
      {/* --- HERO SECTION --- */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="relative z-10 px-6 py-16 sm:px-12 sm:py-24 md:text-center flex flex-col md:items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Global AI Portal
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white tracking-tight mb-6"
          >
            Find Your Next <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              Global Opportunity
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-10 font-medium"
          >
            Discover fully-funded PhDs, prestigious Masters, high-impact internships, and top-tier Bachelors across the world.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-2 rounded-2xl sm:rounded-full flex flex-col sm:flex-row gap-2 shadow-xl"
          >
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by topic, university, or keywords..." 
                className="w-full bg-transparent border-none text-white placeholder:text-slate-400 pl-12 pr-4 py-3 focus:outline-none focus:ring-0 text-sm sm:text-base"
              />
            </div>
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl sm:rounded-full font-bold transition-all flex justify-center items-center gap-2">
              Explore <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>

      {/* --- FILTER & CATEGORY SECTION --- */}
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Active Postings</h2>
          
          {/* Degree Level Filters (Desktop & Mobile Scrollable) */}
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none snap-x p-1.5 md:bg-white md:dark:bg-slate-900 md:border md:border-slate-200 md:dark:border-slate-800 md:rounded-xl shadow-sm">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleTabClick(cat)}
                className={`snap-start whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === cat 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-white md:bg-transparent dark:bg-slate-800 md:dark:bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 md:border-none dark:border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* --- FEED GRID --- */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white/50 dark:bg-slate-900/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 animate-pulse h-64"></div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <Sparkles className="w-10 h-10 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No opportunities found</h3>
            <p className="text-slate-500 mt-2">
              {activeCountry !== 'All' ? `Try removing the "${activeCountry}" country filter or adjusting your search.` : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredData.map((item) => (
              <motion.div
                layoutId={`card-${item.id}`}
                onClick={() => setActiveItem(item)}
                key={item.id}
                className="group cursor-pointer flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover:shadow-xl hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      {item.type}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3.5 h-3.5" /> {item.country}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 mb-2">
                    {item.title}
                  </h3>
                  
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <Building2 className="w-4 h-4" /> {item.organization}
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/50 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span className="truncate">{item.funding_details || 'Funding Unspecified'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    <span>Deadline: {item.deadline || 'Ongoing'}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* --- DETAILED MODAL --- */}
      <AnimatePresence>
        {activeItem && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveItem(null)}
              className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <motion.div
                layoutId={`card-${activeItem.id}`}
                className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden pointer-events-auto border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 shrink-0 relative">
                  <button 
                    onClick={() => setActiveItem(null)}
                    className="absolute top-6 right-6 p-2 bg-slate-200/50 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-3">
                    {activeItem.type}
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white pr-10 leading-tight">
                    {activeItem.title}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mt-3 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    {activeItem.organization} • {activeItem.country}
                  </p>
                </div>

                {/* Modal Scrollable Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Funding & Salary</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{activeItem.funding_details || 'Not specified'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Deadline</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{activeItem.deadline || 'Ongoing'}</p>
                    </div>
                  </div>

                  {activeItem.description && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">About this opportunity</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {activeItem.description}
                      </p>
                    </div>
                  )}

                  {/* Tags mapping safely */}
                  {activeItem.tags && activeItem.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <Tag className="w-4 h-4" /> Tags & Focus Areas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {activeItem.tags.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-4">
                 <button 
  onClick={() => handleSaveApplication(activeItem)}
  disabled={saving}
  className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold transition-colors disabled:opacity-50"
>
  {saving ? 'Saving...' : 'Save to My Applications'}
</button>
                  <a
                    href={activeItem.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors shadow-lg shadow-indigo-500/20"
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