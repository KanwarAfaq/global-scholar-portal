// Tiny inline markup for guide copy: [label](url). Internal links start with "/".
// Shared by the React page and scripts/prerender.mjs so both render identical content.
export function parseInline(value) {
  const out = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  const text = String(value || '');
  let last = 0, match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push({ text: text.slice(last, match.index) });
    out.push({ text: match[1], href: match[2] });
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
export const isInternal = href => href.startsWith('/') && !href.startsWith('//');
export const plainText = value => parseInline(value).map(part => part.text).join('');
