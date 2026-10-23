import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPageItems, pageRange } from '../lib/pagination';

const base = 'inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors select-none';
const idle = 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:bg-slate-700 dark:hover:text-white';
const active = 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/30 dark:border-indigo-500 dark:bg-indigo-500';
const off = 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500';

/**
 * Centered, windowed pagination. Every page is a real link (`getHref(page)`), so pages are
 * crawlable, shareable and work with the Back button. `onNavigate` lets the caller scroll to
 * the results after a client-side navigation.
 */
export default function Pagination({ page, totalPages, getHref, onNavigate, totalItems, pageSize, noun = 'results' }) {
  if (!totalPages || totalPages <= 1) return null;
  const items = getPageItems(page, totalPages, 1);
  const go = target => event => {
    // Let the browser handle modified clicks (new tab) normally.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    onNavigate?.(target);
  };
  const range = totalItems && pageSize ? pageRange(page, pageSize, totalItems) : null;

  const step = (target, label, icon, side) => {
    const disabled = target < 1 || target > totalPages;
    const content = side === 'prev'
      ? <>{icon}<span className="hidden sm:inline">{label}</span></>
      : <><span className="hidden sm:inline">{label}</span>{icon}</>;
    if (disabled) return <span aria-disabled="true" className={`${base} gap-1.5 ${off}`}>{content}</span>;
    return (
      <Link to={getHref(target)} rel={side} onClick={go(target)} aria-label={`${label} page`} className={`${base} gap-1.5 ${idle}`}>
        {content}
      </Link>
    );
  };

  return (
    <nav aria-label="Pagination" className="mt-10 flex w-full flex-col items-center gap-4 border-t border-slate-200 pt-8 text-center dark:border-slate-700">
      <ul className="m-0 flex w-full list-none flex-wrap items-center justify-center gap-1.5 p-0 sm:gap-2">
        <li>{step(page - 1, 'Previous', <ChevronLeft className="h-4 w-4" aria-hidden="true" />, 'prev')}</li>
        {items.map((item, index) => {
          if (typeof item === 'string') {
            return <li key={item + index} aria-hidden="true" className="px-1 text-slate-500 dark:text-slate-400">…</li>;
          }
          const isCurrent = item === page;
          // On phones only show the first, current and last page numbers to keep one tidy row.
          const hideOnPhone = !isCurrent && item !== 1 && item !== totalPages;
          return (
            <li key={item} className={hideOnPhone ? 'hidden sm:block' : undefined}>
              {isCurrent
                ? <span aria-current="page" className={`${base} ${active}`}>{item}</span>
                : <Link to={getHref(item)} onClick={go(item)} aria-label={`Go to page ${item}`} className={`${base} ${idle}`}>{item}</Link>}
            </li>
          );
        })}
        <li>{step(page + 1, 'Next', <ChevronRight className="h-4 w-4" aria-hidden="true" />, 'next')}</li>
      </ul>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400" role="status" aria-live="polite">
        {range ? <>Showing <b className="text-slate-900 dark:text-white">{range.from}–{range.to}</b> of <b className="text-slate-900 dark:text-white">{totalItems}</b> {noun} · </> : null}
        Page <b className="text-slate-900 dark:text-white">{page}</b> of <b className="text-slate-900 dark:text-white">{totalPages}</b>
      </p>
    </nav>
  );
}
