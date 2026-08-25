import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Calendar, Clock, ArrowLeft, Tag, Globe, ExternalLink, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function BlogPost() {
  const { slug } = useParams();
  
  const [post, setPost] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPostData() {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Fetch the main blog post using the URL slug
        const { data: postData, error: postError } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .single();
          
        if (postError) throw postError;
        setPost(postData);

        // 2. Fetch 3 recent posts for the sidebar (excluding current post)
        const { data: sidebarData, error: sidebarError } = await supabase
          .from('blog_posts')
          .select('title, slug, read_time')
          .neq('slug', slug)
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (!sidebarError && sidebarData) {
          setRecentPosts(sidebarData);
        }
      } catch (err) {
        console.error("Error fetching post:", err.message);
        setError("We couldn't find this intelligence report. It may have been removed.");
      } finally {
        setLoading(false);
      }
    }

    fetchPostData();
    window.scrollTo(0, 0);
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 space-y-4">
        <h2 className="text-2xl font-bold text-white">Post Not Found</h2>
        <p className="text-slate-400">{error}</p>
        <Link to="/blog" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors mt-4">
          Return to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-10">
      
      {/* Dynamic SEO Meta Header */}
      <Helmet>
        <title>{post.title} | ScholarPortal</title>
        <meta name="description" content={post.excerpt} />
        
        {/* Open Graph / Social Sharing Tags */}
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="og:image" content={post.image || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200'} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.excerpt} />
      </Helmet>

      {/* Main Content Area */}
      <article className="flex-1 max-w-4xl">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to all articles
        </Link>

        {/* Header */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-wrap gap-2">
            {post.tags && post.tags.map(tag => (
              <span key={tag} className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-md flex items-center gap-1">
                <Tag className="w-3 h-3" /> {tag}
              </span>
            ))}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm font-semibold text-slate-400 pt-2">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> 
              {new Date(post.created_at).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> 
              {post.read_time || '3 min read'}
            </span>
          </div>
        </div>

        {/* Featured Image */}
        <div className="w-full h-64 sm:h-96 rounded-3xl overflow-hidden mb-10 border border-slate-800">
          <img 
  src={post.image || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800'} 
  alt={post.title} 
  onError={(e) => {
    e.target.onerror = null; // Prevents infinite loop if fallback fails
    e.target.src = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800';
  }}
  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
/>
        </div>

        {/* Dynamic HTML Content */}
        <div 
          className="prose prose-invert prose-indigo max-w-none text-slate-300 leading-relaxed text-base sm:text-lg 
                     [&>h3]:text-2xl [&>h3]:font-bold [&>h3]:text-white [&>h3]:mt-8 [&>h3]:mb-4
                     [&>ul]:list-disc [&>ul]:list-inside [&>ul]:space-y-2 [&>ul]:bg-slate-800/30 [&>ul]:p-6 [&>ul]:rounded-2xl [&>ul]:border [&>ul]:border-slate-800 [&>ul]:my-6
                     [&>p]:mb-6"
          dangerouslySetInnerHTML={{ __html: post.content }} 
        />

        {/* Official Source Call-to-Action */}
        {post.original_link && (
          <div className="mt-12 p-6 bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-white font-bold mb-1 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-400"/> Official Source
              </h4>
              <p className="text-sm text-slate-400">View the original posting and official guidelines.</p>
            </div>
            <a href={post.original_link} target="_blank" rel="noopener noreferrer" className="shrink-0 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20">
              Visit Portal <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </article>

      {/* Right Sidebar: Related Posts */}
      <aside className="w-full lg:w-80 shrink-0 space-y-6">
        <div className="sticky top-24 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-lg font-extrabold text-white mb-4 border-b border-slate-800 pb-2">Related Intelligence</h3>
          
          <div className="space-y-4">
            {recentPosts.length === 0 ? (
              <p className="text-sm text-slate-500">No other reports available yet.</p>
            ) : (
              recentPosts.map((recent, index) => (
                <React.Fragment key={recent.slug}>
                  <Link to={`/blog/${recent.slug}`} className="group block">
                    <h4 className="text-sm font-bold text-slate-300 group-hover:text-indigo-400 transition-colors leading-snug mb-1">
                      {recent.title}
                    </h4>
                    <p className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> {recent.read_time || '3 min read'}
                    </p>
                  </Link>
                  {index < recentPosts.length - 1 && <div className="w-full h-px bg-slate-800" />}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </aside>
      
    </div>
  );
}