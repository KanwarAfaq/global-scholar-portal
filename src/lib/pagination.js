// Pure pagination helpers (no React) so they can be unit-tested with `node --test`.

/** Parse a ?page= value into a valid 1-based page number (never NaN, never < 1, never > total). */
export function pageFromParam(value, totalPages = Infinity) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, totalPages));
}

/**
 * Windowed page list: always first and last page, `siblings` pages either side of the current
 * page, and 'ellipsis-start' / 'ellipsis-end' markers where pages are skipped. A gap of exactly
 * one page is shown as that page instead of an ellipsis (so "1 … 3" never hides a single number).
 * Example (current 10 of 20, siblings 1): [1, 'ellipsis-start', 9, 10, 11, 'ellipsis-end', 20]
 */
export function getPageItems(current, total, siblings = 1) {
  total = Math.max(1, Math.floor(total) || 1);
  current = Math.min(Math.max(1, Math.floor(current) || 1), total);
  const slots = siblings * 2 + 5; // first + last + current + both siblings + two ellipsis slots
  if (total <= slots) return Array.from({ length: total }, (_, i) => i + 1);

  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, total);
  const showLeftGap = left > 3;          // pages 2..left-1 has at least 2 hidden pages
  const showRightGap = right < total - 2;

  if (!showLeftGap && showRightGap) {
    const head = 3 + siblings * 2;
    return [...Array.from({ length: head }, (_, i) => i + 1), 'ellipsis-end', total];
  }
  if (showLeftGap && !showRightGap) {
    const tail = 3 + siblings * 2;
    return [1, 'ellipsis-start', ...Array.from({ length: tail }, (_, i) => total - tail + 1 + i)];
  }
  const middle = Array.from({ length: right - left + 1 }, (_, i) => left + i);
  return [1, 'ellipsis-start', ...middle, 'ellipsis-end', total];
}

/** "Showing 10–18 of 74" style range for the current page. */
export function pageRange(page, pageSize, totalItems) {
  if (!totalItems) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  return { from, to: Math.min(page * pageSize, totalItems) };
}
