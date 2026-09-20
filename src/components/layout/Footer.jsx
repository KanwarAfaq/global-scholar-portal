import React from 'react';
import { GraduationCap } from 'lucide-react';
import { FaGithub, FaTwitter, FaLinkedin } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors mt-auto ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Scholar<span className="text-indigo-600 dark:text-indigo-400">Portal</span>
            </span>
          </div>

          {/* Copyright & Links */}
          <div className="text-sm text-slate-500 dark:text-slate-400 font-medium text-center md:text-left">
            © {new Date().getFullYear()} ScholarPortal. All rights reserved.
          </div>

          {/* Socials */}
          <div className="flex gap-4">
            <a href="#" className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <FaTwitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <FaGithub className="w-5 h-5" />
            </a>
            <a href="#" className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <FaLinkedin className="w-5 h-5" />
            </a>
          </div>
          
        </div>
      </div>
    </footer>
  );
}