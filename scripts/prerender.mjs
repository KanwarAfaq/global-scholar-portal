// Generate crawlable public HTML snapshots without exposing private workspace data.
import fs from 'node:fs';
import path from 'node:path';

const file = 'public/seo-pages.json';
if (!fs.existsSync(file)) {
  console.log('SEO snapshots skipped: run Agent/indexing_agent.py with backend credentials first.');
  process.exit(0);
}

const { base, pages } = JSON.parse(fs.readFileSync(file, 'utf8'));
const template = fs.readFileSync('dist/index.html', 'utf8');
const escape = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const text = value => String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const removeManagedHead = html => html
  .replace(/<title>[\s\S]*?<\/title>/gi, '')
  .replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*>/gi, '')
  .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
  .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');


const validWebUrl = value => {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value.trim());
    return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : null;
  } catch { return null; }
};
const relatedLinks = page => {
  const standard = page.kind === 'Article'
    ? [{ path: '/blog', label: 'More scholarship and application guides' }, { path: '/', label: 'Browse verified scholarships' }]
    : [{ path: '/', label: 'Verified scholarships and fellowships' }, { path: '/blog', label: 'Scholarship application guides' }, { path: '/programs', label: 'Verified degree programs' }];
  const words = new Set(String(page.title || '').toLowerCase().match(/[a-z]{5,}/g) || []);
  const related = page.kind !== 'Article' ? [] : pages.filter(item => item.kind === 'Article' && item.path !== page.path)
    .map(item => ({ item, score: (String(item.title || '').toLowerCase().match(/[a-z]{5,}/g) || [])
      .filter(word => words.has(word)).length }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.path.localeCompare(b.item.path))
    .slice(0, 2).map(result => ({ path: result.item.path, label: result.item.title }));
  return [...related, ...standard].filter((link, index, all) =>
    link.path !== page.path && all.findIndex(entry => entry.path === link.path) === index &&
    pages.some(item => item.path === link.path)).slice(0, 4);
};
const officialResources = {
  '/': { url: 'https://educationusa.state.gov/', label: 'EducationUSA official international study guidance' },
  '/blog': { url: 'https://www.daad.de/en/', label: 'DAAD official academic exchange resources' },
  '/programs': { url: 'https://erasmus-plus.ec.europa.eu/', label: 'Erasmus+ official program information' },
};
const officialLink = page => {
  const url = validWebUrl(page.source_url || page.original_link);
  return url && new URL(url).origin !== new URL(base).origin
    ? { url, label: 'Official source and application information' }
    : (officialResources[page.path] || null);
};

for (const page of pages) {
  if (!page.path.startsWith('/') || page.path.includes('..')) throw new Error('Unsafe SEO path');
  const canonical = base + page.path;
  const description = text(page.description || page.title);
  const keyword = text(page.focus_keyword || page.title);
  const article = page.kind === 'Article';
  const published = page.date && !Number.isNaN(Date.parse(page.date)) ? page.date : undefined;
  const modified = page.modified && !Number.isNaN(Date.parse(page.modified)) ? page.modified : published;
  const structured = article ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    ...(published ? { datePublished: published, dateModified: modified } : {}),
    author: { '@type': 'Organization', name: 'ScholarPortal Editorial Team' },
    publisher: { '@type': 'Organization', name: 'ScholarPortal', url: base, logo: { '@type': 'ImageObject', url: base + '/favicon.svg' } },
    ...(validWebUrl(page.image) ? { image: [validWebUrl(page.image)] } : {}),
  } : {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'ScholarPortal', url: base },
  };
  const head = [
    `<title>${escape(page.title)} | ScholarPortal</title>`,
    `<meta name="description" content="${escape(description)}">`,
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    `<link rel="canonical" href="${escape(canonical)}">`,
    '<meta property="og:site_name" content="ScholarPortal">',
    `<meta property="og:type" content="${article ? 'article' : 'website'}">`,
    `<meta property="og:title" content="${escape(page.title)}">`,
    `<meta property="og:description" content="${escape(description)}">`,
    `<meta property="og:url" content="${escape(canonical)}">`,
    page.image ? `<meta property="og:image" content="${escape(page.image)}">` : '',
    `<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}">`,
    `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('');
  const bodyText = text(page.content || '');
  const lead = description.toLowerCase().includes(keyword.toLowerCase())
    ? description : keyword + ' — ' + description;
  const imageUrl = validWebUrl(page.image);
  const source = officialLink(page);
  const links = relatedLinks(page);
  // Provide usable initial HTML for non-JS crawlers without fabricating images or URLs.
  const content = [
    '<article data-seo-snapshot="true">',
    '<h1>' + escape(page.title) + '</h1>',
    '<p>' + escape(lead) + '</p>',
    imageUrl ? '<figure><img src="' + escape(imageUrl) + '" alt="' + escape('Cover image for ' + keyword) + '" loading="lazy"></figure>' : '',
    '<h2>' + escape('About ' + keyword) + '</h2>',
    bodyText && bodyText !== description ? '<div>' + escape(bodyText) + '</div>' : '',
    links.length ? '<nav aria-label="Related ScholarPortal pages"><h2>Related scholarships and guides</h2>' +
      links.map(link => '<a href="' + escape(link.path) + '">' + escape(link.label) + '</a>').join(' · ') + '</nav>' : '',
    source ? '<p>Further information: <a href="' + escape(source.url) + '" rel="noopener noreferrer">' +
      escape(source.label) + '</a>. Confirm details with the official provider.</p>' : '',
    '</article>',
  ].join('');
  const html = removeManagedHead(template)
    .replace('</head>', head + '</head>')
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  const relative = page.path === '/' ? 'index.html' : path.join(page.path.slice(1), 'index.html');
  const destination = path.join('dist', relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html);
}
console.log(`SEO: generated ${pages.length} crawlable public snapshots`);

