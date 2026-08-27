import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Clock, Calendar, ExternalLink, 
  Tag, Loader2, AlertCircle, Sparkles
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function OpportunityBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false); // Tracks if the image fails

  useEffect(() => {
    async function fetchBlogData() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('opportunity_blogs')
          .select('*')
          .eq('opportunity_id', id)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("No blog post exists for this opportunity yet.");
        
        setBlog(data);
      } catch (err) {
        console.error("Error fetching blog:", err.message);
        setError("We couldn't find the deep dive for this opportunity. It may have been removed or is still generating.");
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchBlogData();
  }, [id]);

  // --- BULLETPROOF TEXT RENDERER ---
  const renderContent = (content) => {
    if (!content) return null;

    // Strictly check for structural HTML tags, not just random brackets
    const hasStructuralHTML = /<(p|h[1-6]|ul|ol|li|strong|em|div|span)[\s>]/i.test(content);

    if (hasStructuralHTML) {
      return (
        <div 
          className="prose prose-slate dark:prose-invert prose-lg md:prose-xl max-w-none 
                     prose-headings:font-extrabold prose-headings:text-slate-900 dark:prose-headings:text-slate-100
                     prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-[1.8]
                     prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:font-semibold"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    // If it's plain text (like in your screenshot), manually format it perfectly
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    return (
      <div className="text-slate-700 dark:text-slate-300 text-lg md:text-xl leading-[1.8] space-y-5 max-w-none">
        {lines.map((line, index) => {
          const trimmed = line.trim();
          
          // Detect headers: Short lines without ending punctuation
          if (trimmed.length < 50 && !trimmed.endsWith('.') && !trimmed.endsWith(',')) {
            return (
              <h3 key={index} className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mt-10 mb-4 tracking-tight border-b border-slate-100 dark:border-slate-800 pb-3">
                {trimmed}
              </h3>
            );
          }
          
          // Detect bullet points: Starts with a dash, asterisk, or bullet
          if (trimmed.match(/^[-*•]\s/) || trimmed.match(/^\d+\.\s/)) {
            const cleanText = trimmed.replace(/^[-*•]\s|^\d+\.\s/, '');
            return (
              <div key={index} className="flex items-start gap-3 ml-2 sm:ml-4">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0"></div>
                <p>{cleanText}</p>
              </div>
            );
          }

          // Render normal paragraph
          return <p key={index}>{trimmed}</p>;
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-slate-600 dark:text-slate-400 font-medium animate-pulse">
            Loading AI deep dive...
          </p>
        </div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 text-center shadow-xl border border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Blog Not Found</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">{error}</p>
          <button 
            onClick={() => navigate(-1)}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] transition-colors duration-300 pb-24 selection:bg-indigo-500/30">
      
      {/* Navigation Bar */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </div>

      <motion.article 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12"
      >
        {/* Header Section */}
        <header className="mb-12 max-w-4xl mx-auto text-center sm:text-left">
          {blog.tags && blog.tags.length > 0 && (
            <div className="flex flex-wrap justify-center sm:justify-start gap-2.5 mb-8">
              {blog.tags.map((tag, idx) => (
                <span key={idx} className="px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-sm">
                  <Tag className="w-3.5 h-3.5" /> {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white leading-[1.15] mb-8 tracking-tight">
            {blog.title}
          </h1>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Clock className="w-4 h-4 text-indigo-500" />
              {blog.read_time || '3 min read'}
            </span>
            <span className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Calendar className="w-4 h-4 text-emerald-500" />
              {new Date(blog.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Hero Image with Native CSS Placeholder */}
        <div className="relative w-full h-[300px] sm:h-[450px] md:h-[550px] rounded-[2.5rem] overflow-hidden mb-16 shadow-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-900 flex items-center justify-center group">
          {!imageError && blog.image ? (
            <img 
              src={blog.image} 
              alt={blog.title} 
              onError={() => setImageError(true)}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
          ) : (
            // Native CSS Fallback (No network requests, never breaks)
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 flex flex-col items-center justify-center gap-4">
              <div className="p-5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                <Sparkles className="w-12 h-12 text-indigo-300" />
              </div>
              <p className="text-indigo-200/50 font-medium tracking-widest uppercase text-sm">Deep Dive Report</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
        </div>

        {/* Focused Reading Column */}
        <div className="max-w-4xl mx-auto bg-white dark:bg-[#0b1120] rounded-[2.5rem] p-8 sm:p-12 md:p-16 shadow-2xl border border-slate-200 dark:border-slate-800/80 relative">
          <div className="absolute top-0 left-10 right-10 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 rounded-b-full opacity-80"></div>
          
          {renderContent(blog.content)}
        </div>

        {/* Call to Action Footer */}
        {blog.original_link && (
          <div className="mt-16 max-w-3xl mx-auto bg-gradient-to-br from-indigo-50 dark:from-indigo-950/40 to-sky-50 dark:to-cyan-950/20 border border-indigo-100 dark:border-indigo-500/30 rounded-[2.5rem] p-10 sm:p-16 text-center shadow-lg relative overflow-hidden">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-5 relative z-10">
              Ready to take the next step?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-10 text-lg relative z-10 max-w-lg mx-auto leading-relaxed">
              Review the official guidelines and prepare your application materials before the deadline approaches.
            </p>
            <a
              href={blog.original_link}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex items-center justify-center gap-3 px-12 py-5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-lg transition-all shadow-[0_10px_40px_rgba(79,70,229,0.3)] transform hover:-translate-y-1"
            >
              Visit Official Portal <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        )}

      </motion.article>
    </div>
  );
}