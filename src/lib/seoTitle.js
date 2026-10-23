// Shared by the prerender script and the client so <title> text is identical before and after hydration.
const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
const SEPARATORS = [' – ', ' — ', ': ', ' | ', ' - '];
const WEAK_END = /\s(?:a|an|and|for|in|of|on|or|the|to|with|at|by|from)$/i;

/** Shorten a title for <title>/og:title to ≤ max chars, cutting at a subtitle separator or word boundary. */
export function shortenTitle(title, max = 60) {
  const t = clean(title);
  if (t.length <= max) return t;
  for (const sep of SEPARATORS) {
    const i = t.indexOf(sep);
    if (i >= 25 && i <= max) return t.slice(0, i);
  }
  let cut = t.slice(0, max + 1);
  cut = cut.slice(0, Math.max(cut.lastIndexOf(' '), Math.floor(max * 0.6)));
  cut = cut.replace(/[\s,;:–—&-]+$/, '');
  while (WEAK_END.test(cut)) cut = cut.replace(WEAK_END, '');
  return cut;
}

/**
 * Group pages that share a title. The first page in manifest order is the primary; the others get a
 * canonical pointing at it and a distinct title so each <title> in the site is unique.
 * Returns Map(path -> { canonicalPath, titleSuffix }) for the non-primary pages only.
 */
export function findDuplicateTitles(pages) {
  const groups = new Map();
  for (const page of pages) {
    const key = clean(page.title).toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(page);
  }
  const result = new Map();
  for (const group of groups.values()) {
    group.slice(1).forEach((page, i) => result.set(page.path, { canonicalPath: group[0].path, titleSuffix: ` (Version ${i + 2})` }));
  }
  return result;
}
