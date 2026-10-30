// Merge src/content/guides.json into the committed public SEO artifacts (idempotent).
// Agent/indexing_agent.py does the same when it regenerates them from the database.
import fs from 'node:fs';
const { date, guides } = JSON.parse(fs.readFileSync('src/content/guides.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('public/seo-pages.json', 'utf8'));
const base = manifest.base.replace(/\/$/, '');
manifest.pages = manifest.pages.filter(p => !p.path.startsWith('/guides/'));
const entries = guides.map(g => ({ path: '/guides/' + g.slug, title: g.title, focus_keyword: g.focus_keyword, description: g.description,
  sections: g.sections, faqs: g.faqs, related: g.related || [], date, kind: 'Article' }));
const firstArticle = manifest.pages.findIndex(p => p.kind === 'Article');
manifest.pages.splice(firstArticle < 0 ? manifest.pages.length : firstArticle, 0, ...entries);
fs.writeFileSync('public/seo-pages.json', JSON.stringify(manifest));
let sitemap = fs.readFileSync('public/sitemap.xml', 'utf8').replace(/<url><loc>[^<]*\/guides\/[^<]*<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?<\/url>/g, '');
const urls = entries.map(e => `<url><loc>${base}${e.path}</loc><lastmod>${date}</lastmod></url>`).join('');
sitemap = sitemap.replace(`<url><loc>${base}/privacy-policy</loc></url>`, m => m + urls);
fs.writeFileSync('public/sitemap.xml', sitemap);
let llms = fs.readFileSync('public/llms.txt', 'utf8').replace(/## Study guides\n(?:- [^\n]*\n)*\n/, '');
llms = llms.replace('## Machine-readable', '## Study guides\n' + entries.map(e => `- [${e.title}](${base}${e.path}): ${e.description}`).join('\n') + '\n\n## Machine-readable');
fs.writeFileSync('public/llms.txt', llms);
console.log('synced', entries.length, 'guides');
