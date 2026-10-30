import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { FaGithub } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <Link to="/" className="flex items-center gap-2" aria-label="ScholarPortal home">
            <div className="bg-indigo-600 p-1.5 rounded-lg"><GraduationCap className="w-5 h-5 text-white" aria-hidden="true" /></div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Scholar<span className="text-indigo-600 dark:text-indigo-400">Portal</span>
            </span>
          </Link>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium text-center">
            © {new Date().getFullYear()} ScholarPortal. All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold" aria-label="Footer navigation">
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/">Scholarships</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/blog">Application guides</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/programs">Degree programs</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/guides/scholarships-for-international-students">International student guide</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/guides/fully-funded-scholarships-what-is-covered">Fully funded explained</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/guides/how-to-read-scholarship-eligibility-and-deadlines">Eligibility and deadlines</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/guides/study-in-taiwan-scholarships-guide">Study in Taiwan</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/pricing">Pricing</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/privacy-policy">Privacy</Link>
            <Link className="text-slate-600 dark:text-slate-300 hover:text-indigo-600" to="/terms">Terms</Link>
            <a href="https://github.com/KanwarAfaq/global-scholar-portal" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600" aria-label="ScholarPortal source code on GitHub">
              <FaGithub aria-hidden="true" /> GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
