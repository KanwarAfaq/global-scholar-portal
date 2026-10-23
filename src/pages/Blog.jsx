import {supabase} from '../lib/supabase';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import Pagination from '../components/Pagination';
import { pageFromParam } from '../lib/pagination';
import { articleCover, articleFallback } from '../lib/articleImages';

// Initialize Supabase


const ITEMS_PER_PAGE = 10;

export default function Blog() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  // The page lives in the URL (?page=N): shareable, crawlable, and the Back button works.
  // It is not clamped to totalPages here because the total is unknown until the first response.
  const currentPage = pageFromParam(searchParams.get('page'));
  const [totalPages, setTotalPages] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const gridTop = useRef(null);
  const firstLoad = useRef(true);
  const imageCounts = blogs.reduce((counts, post) => {
    const image = String(post.image || '').trim();
    if (image) counts[image] = (counts[image] || 0) + 1;
    return counts;
  }, {});

  useEffect(() => {
    async function fetchBlogs() {
      setLoading(true);
      try {
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        // Fetch paginated blog posts and the exact total count from Supabase
        const { data, error, count } = await supabase
          .from('blog_posts')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
          
        if (error) throw error;
        
        if (data) {
          setBlogs(data);
          if (count) {
            const pages = Math.max(1, Math.ceil(count / ITEMS_PER_PAGE));
            setTotalPages(pages);
            setTotalPosts(count);
          }
        }
      } catch (err) {
        console.error("Error fetching blogs:", err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchBlogs();
    // Scroll to the top of the list after paging, but never yank the page on the first visit.
    if (firstLoad.current) firstLoad.current = false;
    else gridTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentPage]);

  // A stale or hand-edited ?page=99 should land on the last real page, not an empty list.
  useEffect(() => {
    if (!loading && totalPosts > 0 && currentPage > totalPages) {
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('page', String(totalPages)); return next; }, { replace: true });
    }
  }, [loading, totalPosts, totalPages, currentPage, setSearchParams]);

  const pageHref = page => (page <= 1 ? '/blog' : '/blog?page=' + page);

  return (
    <div className="mx-auto w-full space-y-10 py-4 sm:py-6">
      
      {/* Blog Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
          Scholarship <span className="text-indigo-600 dark:text-indigo-400">Application Guides 2026–2027</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg transition-colors">
          Explore scholarships, eligibility, application tips and official deadlines.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Latest Scholarship and Application Guides</h2>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-500" />
        </div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p>No articles published yet.</p>
        </div>
      ) : (
        <>
          {/* Blog Grid */}
          <div ref={gridTop} className="scroll-mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogs.map((post, index) => (
              <Link 
                key={post.id} 
                to={`/blog/${post.slug}`}
                className="group flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl dark:shadow-none hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Image */}
                <div className="h-48 overflow-hidden relative bg-slate-100 dark:bg-slate-800">
                  <img 
                    src={articleCover(post, index, imageCounts[String(post.image || '').trim()] > 1)}
                    alt={post.title} 
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = articleFallback(post, index + 1);
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 dark:from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-6">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {post.tags && post.tags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-md transition-colors">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {post.title}
                  </h2>
                  
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-3 flex-1 transition-colors">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 transition-colors">
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

          {/* Pagination Controls */}
          <Pagination
            page={Math.min(currentPage, totalPages)}
            totalPages={totalPages}
            getHref={pageHref}
            totalItems={totalPosts}
            pageSize={ITEMS_PER_PAGE}
            noun="guides"
          />
        </>
      )}
    </div>
  );
}
