import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Blog() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBlogs() {
      try {
        // Fetch all blog posts from Supabase, newest first
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        if (data) setBlogs(data);
      } catch (err) {
        console.error("Error fetching blogs:", err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchBlogs();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-10">
      
      {/* Blog Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Opportunity <span className="text-indigo-400">Insights</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          Daily curated intelligence, application strategies, and deadline alerts scoured from top universities globally.
        </p>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p>No intelligence reports found yet. The AI agent is gathering data!</p>
        </div>
      ) : (
        /* Blog Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogs.map((post) => (
            <Link 
              key={post.id} 
              to={`/blog/${post.slug}`}
              className="group flex flex-col bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Image */}
              <div className="h-48 overflow-hidden relative">
                <img 
  src={post.image || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200'} 
  alt={post.title} 
  onError={(e) => {
    e.target.onerror = null;
    e.target.src = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200';
  }}
  className="w-full h-full object-cover" 
/>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
              </div>

              {/* Content */}
              <div className="flex flex-col flex-1 p-6">
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.tags && post.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-md">
                      {tag}
                    </span>
                  ))}
                </div>
                
                <h2 className="text-xl font-bold text-white mb-2 leading-tight group-hover:text-indigo-400 transition-colors">
                  {post.title}
                </h2>
                
                <p className="text-sm text-slate-400 mb-6 line-clamp-3 flex-1">
                  {post.excerpt}
                </p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> 
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> 
                      {post.read_time || '3 min read'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}