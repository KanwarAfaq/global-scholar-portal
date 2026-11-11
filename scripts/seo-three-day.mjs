// Read-only rotating production SEO audit. No credentials or indexing submissions.
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
const origin = new URL(process.env.SEO_SITE_URL || 'https://example.invalid').origin;
if (!origin.startsWith('https://') || origin.includes('example.invalid')) throw new Error('SEO_SITE_URL must be the HTTPS production origin');
const limit = Math.min(150, Math.max(5, Number(process.env.SEO_MAX_PAGES || 100)));
const UA = 'Owner-SEO-ThreeDay-Audit/1.0';
const issues = [], pages = [], visited = new Set();
const warning = (url, reason, severity = 'warning') => issues.push({ url, reason, severity });
const request = async (url) => {
  const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(12000) });
  return { status: r.status, finalUrl: r.url, headers: r.headers, body: await r.text() };
};
const attr = (tag, key) => tag.match(new RegExp('\\b' + key + '\\s*=\\s*["\\x27]([^"\\x27]*)["\\x27]', 'i'))?.[1] || '';
const normalize = value => { try { const u = new URL(value); return u.origin + (u.pathname.replace(/\/$/, '') || '/'); } catch { return ''; } };
async function sitemap(url, depth = 0) {
  if (visited.has(url) || depth > 2) return [];
  visited.add(url);
  const r = await request(url);
  if (r.status !== 200) throw new Error('Sitemap HTTP ' + r.status + ' (' + url + ')');
  const content = r.body;
  if (!/<(?:\w+:)?(?:urlset|sitemapindex)\b/i.test(content)) throw new Error('Invalid sitemap XML response: ' + url);
  const locs = [...content.matchAll(/<(?:\w+:)?loc>\s*([^<]+)\s*<\/(?:\w+:)?loc>/gi)].map(m => m[1].trim().replace(/&amp;/g,'&'));
  if (/<(?:\w+:)?sitemapindex\b/i.test(content)) {
    let urls = [];
    for (const child of locs.slice(0, 50)) {
      const u = new URL(child);
      if (u.origin !== origin) { warning(child,'Off-domain sitemap child'); continue; }
      urls.push(...await sitemap(u.href, depth + 1));
    }
    return urls;
  }
  return locs.filter(u => { try { return new URL(u).origin === origin; } catch { return false; } });
}
function pageSignals(html, url, robotsHeader) {
  const head = html.split(/<\/head>/i)[0] || html.slice(0, 18000);
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(x => x[0]);
  const canonicalLinks = links.filter(x => /\bcanonical\b/i.test(attr(x,'rel')));
  const canonical = canonicalLinks.length ? new URL(attr(canonicalLinks[0], 'href'), url).href : null;
  const meta = [...head.matchAll(/<meta\b[^>]*>/gi)].map(x => x[0]);
  const directives = meta.filter(x => /^(robots|googlebot)$/i.test(attr(x,'name'))).map(x => attr(x,'content')).join(',') + ',' + (robotsHeader || '');
  return { canonical, noindex: /\b(noindex|none)\b/i.test(directives), hasTitle: /<title\b[^>]*>\s*[^<\s]/i.test(head), hasH1: /<h1\b[^>]*>/i.test(html), canonicalCount: canonicalLinks.length };
}
async function checkPage(url) {
  try {
    const r = await request(url);
    const signals = pageSignals(r.body, r.finalUrl, r.headers.get('x-robots-tag'));
    const page = { url, status: r.status, finalUrl: r.finalUrl, ...signals };
    pages.push(page);
    if (r.status !== 200) warning(url, 'Sitemap page returns HTTP ' + r.status, 'critical');
    if (signals.noindex) warning(url, 'Sitemap page includes a noindex directive', 'critical');
    if (!signals.canonical) warning(url, 'No canonical in server HTML');
    else if (normalize(signals.canonical) !== normalize(url)) warning(url, 'Canonical differs from sitemap URL: ' + signals.canonical);
    if (signals.canonicalCount > 1) warning(url, 'Multiple canonical links in server HTML');
    if (!signals.hasTitle) warning(url, 'Missing server-rendered title');
    if (!signals.hasH1) warning(url, 'Missing server-rendered H1; check JS-only/soft-404 rendering');
    if (normalize(r.finalUrl) !== normalize(url)) warning(url, 'Sitemap URL redirects to ' + r.finalUrl);
  } catch (error) { warning(url, 'Failed to fetch page: ' + error.message, 'critical'); }
}
const started = new Date();
let home = null, robots = null, allUrls = [];
try {
  home = await request(origin + '/');
  if (home.status !== 200) warning(origin + '/', 'Homepage HTTP ' + home.status, 'critical');
} catch (e) { warning(origin + '/', 'Homepage request failed: ' + e.message, 'critical'); }
try {
  robots = await request(origin + '/robots.txt');
  if (robots.status !== 200) warning(origin + '/robots.txt', 'Robots HTTP ' + robots.status, 'critical');
  if (!robots.body.includes(origin + '/sitemap.xml')) warning(origin + '/robots.txt', 'Canonical sitemap not declared');
  if (/^\s*Disallow:\s*\/\s*$/im.test(robots.body) && !/^\s*Allow:\s*\/\s*$/im.test(robots.body)) warning(origin + '/robots.txt', 'Check a possible full-site crawl block');
} catch (e) { warning(origin + '/robots.txt', 'Robots request failed: ' + e.message, 'critical'); }
try { allUrls = [...new Set(await sitemap(origin + '/sitemap.xml'))]; if (!allUrls.length) warning(origin + '/sitemap.xml','Sitemap has no URLs','critical'); }
catch (e) { warning(origin + '/sitemap.xml', e.message, 'critical'); }
const cycle = Math.floor(Date.now() / 86400000 / 3);
const fixed = allUrls.slice(0, Math.min(5, allUrls.length));
const rotation = allUrls.length <= limit ? allUrls : Array.from({length:limit - fixed.length}, (_,i) => allUrls[(cycle * (limit - fixed.length) + i) % allUrls.length]);
const selection = [...new Set([...fixed, ...rotation])];
let next = 0;
await Promise.all(Array.from({length:6}, async () => { while(next < selection.length) await checkPage(selection[next++]); }));
const report = { site: origin, checkedAt: new Date().toISOString(), cadence: 'every third UTC day, plus manual runs', totalSitemapUrls: allUrls.length, sampledUrls: selection.length, indexStatus: 'Not queried; GSC URL Inspection is required for indexing verdicts', criticalCount: issues.filter(x=>x.severity==='critical').length, warningCount: issues.filter(x=>x.severity!=='critical').length, issues, pages };
const markdown = ['# Production SEO review: ' + origin, '- Checked: ' + report.checkedAt, '- Sitemap URLs: ' + allUrls.length, '- Inspected in this run: ' + selection.length + ' (rotating selection)', '- Critical: ' + report.criticalCount + '; warnings: ' + report.warningCount, '- This is HTTP/on-page checking, not proof of Google index coverage.', '', '## Issues', ...issues.slice(0,80).map(i => '- **' + i.severity.toUpperCase() + '** ' + i.url + ': ' + i.reason), ...(issues.length > 80 ? ['- Additional issues in JSON report'] : [])].join('\n');
await mkdir('reports',{recursive:true});
await writeFile('reports/seo-three-day.json', JSON.stringify(report,null,2));
await writeFile('reports/seo-three-day.md',markdown);
if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
console.log(JSON.stringify({site:origin,total:allUrls.length,checked:selection.length,critical:report.criticalCount,warnings:report.warningCount}));
if(report.criticalCount) process.exitCode = 1;
