import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-4 text-center">
      <Helmet>
        <title>Page not found | ScholarPortal</title>
        <meta name="robots" content="noindex,follow,noarchive" />
      </Helmet>
      <div className="max-w-lg">
        <p className="text-sm font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">404</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Page not found</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          This URL is no longer available or never existed.
        </p>
        <a href="/" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700">
          Go to ScholarPortal
        </a>
      </div>
    </div>
  );
}
