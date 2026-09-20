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

for (const page of pages) {
  if (!page.path.startsWith('/') || page.path.includes('..')) throw new Error('Unsafe SEO path');
  const canonical = base + page.path;
  const description = page.description || page.title;
  const article = page.kind === 'Article';
  const structured = article ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    datePublished: page.date,
    dateModified: page.modified || page.date,
    author: { '@type': 'Organization', name: 'ScholarPortal Editorial Team' },
    publisher: { '@type': 'Organization', name: 'ScholarPortal', url: base, logo: { '@type': 'ImageObject', url: base + '/favicon.svg' } },
    ...(page.image ? { image: [page.image] } : {}),
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
  const bodyText = text(page.content || description);
  const content = `<article data-seo-snapshot="true"><h1>${escape(page.title)}</h1><p>${escape(description)}</p>${bodyText && bodyText !== description ? `<div>${escape(bodyText)}</div>` : ''}</article>`;
  const html = removeManagedHead(template)
    .replace('</head>', head + '</head>')
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  const relative = page.path === '/' ? 'index.html' : path.join(page.path.slice(1), 'index.html');
  const destination = path.join('dist', relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html);
}
console.log(`SEO: generated ${pages.length} crawlable public snapshots`);

