// Generate crawlable public HTML snapshots without exposing private workspace data.
import fs from 'node:fs';
import path from 'node:path';

const file = 'public/seo-pages.json';
if (!fs.existsSync(file)) {
  throw new Error('Missing public/seo-pages.json: refusing to deploy without existing public pages. Run Agent/indexing_agent.py first.');
}

const { base, pages } = JSON.parse(fs.readFileSync(file, 'utf8'));
if (base?.replace(/\/$/, '') !== 'https://scholarportal.site' || !Array.isArray(pages) || !pages.length) {
  throw new Error('Invalid public SEO manifest: expected ScholarPortal origin and nonempty pages.');
}
const paths = new Set();
for (const page of pages) {
  if (typeof page.path !== 'string' || !page.path.startsWith('/') || page.path.startsWith('//') || /[?#\\]/.test(page.path) || page.path.split('/').includes('..') || paths.has(page.path)) {
    throw new Error(`Invalid or duplicate public page path: ${page.path}`);
  }
  paths.add(page.path);
}
const siteUrl = base.replace(/\/$/, '');
// Default social/rich-result image (1200x630) for the many pages that have no cover image of their own.
const DEFAULT_IMAGE = { url: siteUrl + '/og-default.jpg', width: 1200, height: 630, alt: 'ScholarPortal — verified global scholarships and opportunities' };
const LOGO = { url: siteUrl + '/logo-512.png', width: 512, height: 512 };
const SUFFIX = ' | ScholarPortal';
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
// Search results cut titles near 60 characters and descriptions near 160, so trim on a word boundary
// for the <head> only (the full text stays in the page body). Brand suffix only when it still fits.
const clamp = (value, max) => {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), Math.floor(max * 0.6))).replace(/[\s,;:–—-]+$/, '') + '…';
};
const metaTitle = title => { const t = String(title || '').replace(/\s+/g, ' ').trim(); return t.length + SUFFIX.length <= 65 ? t + SUFFIX : t; };
const breadcrumbTrail = page => {
  const home = { name: 'Home', path: '/' };
  if (page.path === '/') return [home];
  if (page.path.startsWith('/blog/')) return [home, { name: 'Application guides', path: '/blog' }, { name: page.title, path: page.path }];
  return [home, { name: page.title, path: page.path }];
};
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
// Link each public article from a crawlable HTML hub, not solely from XML sitemaps.
// Google's crawler can follow these anchors even if client-side data requests fail.
const hubLinks = page => {
  if (page.path !== '/' && page.path !== '/blog') return '';
  const articles = pages.filter(item => item.kind === 'Article')
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')));
  const sections = [
    { heading: 'Scholarship application guides', items: articles.filter(item => item.path.startsWith('/blog/')) },
    { heading: 'Scholarship and opportunity reports', items: articles.filter(item => item.path.startsWith('/opportunity/')) },
  ];
  const limit = page.path === '/' ? 12 : 250;
  const lists = sections.map(section => {
    const links = section.items.slice(0, limit);
    if (!links.length) return '';
    return '<section><h2>' + escape(section.heading) + '</h2><ul>' +
      links.map(link => '<li><a href="' + escape(link.path) + '">' + escape(link.title) + '</a></li>').join('') +
      '</ul></section>';
  }).filter(Boolean);
  return lists.length ? '<nav aria-label="Browse public scholarship articles" data-seo-article-hub="true">' +
    lists.join('') + '</nav>' : '';
};
const homeFaqs = [
  ['What does a fully funded scholarship cover?', 'Coverage varies by program. It can include tuition and a living allowance; travel, housing and insurance may or may not be included. Check each provider’s official funding terms.'],
  ["How can I find 2027 master's and PhD scholarships?", 'Search the opportunities above by degree, country and field of study. Compare the closing date, eligibility rules and official application page before applying.'],
  ['Where can I get scholarship application help?', 'Read our scholarship application guides for research and preparation, and compare study abroad degree programs. Official university and funder instructions always take precedence.'],
];
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

// Keep crawlable HTML titles synchronized even before the next scheduled sitemap refresh.
const landingSeo = {
  '/': {
    title: 'Fully Funded Scholarships 2026–2027 for International Students',
    description: 'Explore fully funded scholarships 2026–2027 for international students, including master’s, PhD, fellowships and internships. Compare eligibility, funding, deadlines and official sources.',
    focus_keyword: 'fully funded scholarships 2026–2027',
  },
  '/blog': {
    title: 'Scholarship Application Guides 2026–2027',
    description: 'Scholarship application guides for international students: eligibility, personal statements, funding, deadlines and how to apply for study abroad scholarships.',
    focus_keyword: 'scholarship application guides 2026–2027',
  },
  '/programs': {
    title: 'Study Abroad Degree Programs for International Students',
    description: 'Find study abroad degree programs for international students, compare academic admission requirements, tuition, funding and official university sources.',
    focus_keyword: 'study abroad degree programs',
  },
};
for (const page of pages) {
  if (landingSeo[page.path]) Object.assign(page, landingSeo[page.path]);
  if (!page.path.startsWith('/') || page.path.includes('..')) throw new Error('Unsafe SEO path');
  const canonical = base + page.path;
  const description = text(page.description || page.title);
  const metaDescription = clamp(description, 158);
  const ownImage = validWebUrl(page.image);
  const socialImage = ownImage || DEFAULT_IMAGE.url;
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
    inLanguage: 'en',
    isAccessibleForFree: true,
    author: { '@type': 'Organization', name: 'ScholarPortal Editorial Team' },
    publisher: { '@type': 'Organization', name: 'ScholarPortal', url: base, logo: { '@type': 'ImageObject', url: LOGO.url, width: LOGO.width, height: LOGO.height } },
    image: [socialImage],
  } : {
    '@context': 'https://schema.org',
    '@type': page.path === '/' ? 'FAQPage' : 'WebPage',
    name: page.title,
    description,
    url: canonical,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'ScholarPortal', url: base },
    ...(page.path === '/' ? { mainEntity: homeFaqs.map(([question, answer]) => ({
      '@type': 'Question', name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })) } : {}),
  };
  // Second JSON-LD block (the first keeps the page's own type): who publishes the site, the site search
  // (which the homepage really supports via /?q=), and the breadcrumb trail.
  const trail = breadcrumbTrail(page);
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': siteUrl + '/#organization', name: 'ScholarPortal', url: siteUrl + '/',
        logo: { '@type': 'ImageObject', url: LOGO.url, width: LOGO.width, height: LOGO.height } },
      { '@type': 'WebSite', '@id': siteUrl + '/#website', url: siteUrl + '/', name: 'ScholarPortal', inLanguage: 'en',
        description: 'Verified global scholarships, fellowships, internships and degree programs with official sources.',
        publisher: { '@id': siteUrl + '/#organization' },
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: siteUrl + '/?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } },
      ...(trail.length > 1 ? [{ '@type': 'BreadcrumbList', itemListElement: trail.map((item, index) => ({
        '@type': 'ListItem', position: index + 1, name: item.name, item: siteUrl + item.path })) }] : []),
    ],
  };
  const head = [
    `<title>${escape(metaTitle(page.title))}</title>`,
    `<meta name="description" content="${escape(metaDescription)}">`,
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    `<link rel="canonical" href="${escape(canonical)}">`,
    '<meta property="og:site_name" content="ScholarPortal">',
    `<meta property="og:type" content="${article ? 'article' : 'website'}">`,
    `<meta property="og:title" content="${escape(page.title)}">`,
    `<meta property="og:description" content="${escape(metaDescription)}">`,
    `<meta property="og:url" content="${escape(canonical)}">`,
    '<meta property="og:locale" content="en_US">',
    `<meta property="og:image" content="${escape(socialImage)}">`,
    ownImage ? '' : `<meta property="og:image:width" content="${DEFAULT_IMAGE.width}"><meta property="og:image:height" content="${DEFAULT_IMAGE.height}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:alt" content="${escape(DEFAULT_IMAGE.alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escape(page.title)}">`,
    `<meta name="twitter:description" content="${escape(metaDescription)}">`,
    `<meta name="twitter:image" content="${escape(socialImage)}">`,
    `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>`,
    `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`,
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
    trail.length > 1 ? '<nav aria-label="Breadcrumb">' + trail.map((item, index) => index === trail.length - 1
      ? '<span>' + escape(clamp(item.name, 80)) + '</span>'
      : '<a href="' + escape(item.path) + '">' + escape(item.name) + '</a>').join(' › ') + '</nav>' : '',
    '<h1>' + escape(page.title) + '</h1>',
    '<p>' + escape(lead) + '</p>',
    article && published ? '<p><small>By ScholarPortal Editorial Team · Published <time datetime="' + escape(published) + '">' + escape(published.slice(0, 10)) + '</time>' +
      (modified && modified.slice(0, 10) !== published.slice(0, 10) ? ' · Updated <time datetime="' + escape(modified) + '">' + escape(modified.slice(0, 10)) + '</time>' : '') + '</small></p>' : '',
    imageUrl ? '<figure><img src="' + escape(imageUrl) + '" alt="' + escape('Cover image for ' + keyword) + '" loading="lazy"></figure>' : '',
    '<h2>' + escape('About ' + keyword) + '</h2>',
    bodyText && bodyText !== description ? '<div>' + escape(bodyText) + '</div>' : '',
    hubLinks(page),
    links.length ? '<nav aria-label="Related ScholarPortal pages"><h2>Related scholarships and guides</h2>' +
      links.map(link => '<a href="' + escape(link.path) + '">' + escape(link.label) + '</a>').join(' · ') + '</nav>' : '',
    page.path === '/' ? '<section aria-labelledby="scholarship-faq-heading"><h2 id="scholarship-faq-heading">Fully Funded Scholarships for International Students: FAQs</h2>' +
      homeFaqs.map(([question, answer]) => '<section><h3>' + escape(question) + '</h3><p>' + escape(answer) + '</p></section>').join('') +
      '<p>Explore <a href="/blog">scholarship application guides</a> and <a href="/programs">study abroad degree programs</a>.</p></section>' : '',
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

// Pages that share a title compete with each other in search results. This is an editorial decision
// (merge or 301 the weaker page), so the build reports them instead of silently changing anything.
const byTitle = new Map();
for (const page of pages) {
  const key = String(page.title || '').trim().toLowerCase();
  if (!key) continue;
  if (!byTitle.has(key)) byTitle.set(key, []);
  byTitle.get(key).push(page.path);
}
const duplicates = [...byTitle.entries()].filter(([, paths]) => paths.length > 1);
if (duplicates.length) {
  console.warn(`SEO WARNING: ${duplicates.length} title(s) are shared by multiple pages (consolidate or redirect):`);
  for (const [title, paths] of duplicates.slice(0, 20)) console.warn(`  - "${title.slice(0, 70)}" → ${paths.join(', ')}`);
  if (duplicates.length > 20) console.warn(`  … and ${duplicates.length - 20} more`);
}

// llms.txt for answer engines / AI crawlers: regenerated every build from the real manifest so the
// "latest" list never goes stale. Plain facts only; nothing here is a ranking or traffic claim.
const mdSafe = value => String(value || '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
const latest = pages.filter(page => page.kind === 'Article' && page.date && !Number.isNaN(Date.parse(page.date)))
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.path.localeCompare(b.path)).slice(0, 30);
const articleCount = pages.filter(page => page.kind === 'Article').length;
const llms = [
  '# ScholarPortal',
  '',
  '> ScholarPortal helps students discover verified global scholarships, fellowships, internships and degree programs, and prepare evidence-based applications. Every record links to its official source.',
  '',
  '## About',
  `- Publisher: ScholarPortal Editorial Team (${siteUrl}/)`,
  '- Audience: international students comparing funded study and research opportunities',
  `- Coverage: ${articleCount} public guides and opportunity reports${latest[0] ? `; most recent published ${latest[0].date.slice(0, 10)}` : ''}`,
  '- Language: English',
  '- Accuracy: deadlines, eligibility and funding change. The official provider page linked from each record is authoritative; confirm details there before applying.',
  '',
  '## Core pages',
  `- [Scholarship and opportunity directory](${siteUrl}/): searchable by degree level, country and field; supports ?q=keyword`,
  `- [Scholarship application guides](${siteUrl}/blog): eligibility, deadlines, documents and how to apply`,
  `- [Degree programs](${siteUrl}/programs): study abroad program comparisons with official university sources`,
  `- [Pricing](${siteUrl}/pricing)`,
  `- [Terms](${siteUrl}/terms)`,
  `- [Privacy policy](${siteUrl}/privacy-policy)`,
  '',
  '## Latest guides and reports',
  ...latest.map(page => `- [${mdSafe(page.title)}](${siteUrl}${page.path}): ${mdSafe(clamp(text(page.description || ''), 140))}`),
  '',
  '## Machine-readable',
  `- [XML sitemap](${siteUrl}/sitemap.xml)`,
  '',
  '## Citing ScholarPortal',
  '- Cite the specific page URL and its published date; link to the official provider page for deadlines and eligibility.',
  '- AI-generated application guidance inside the product must be reviewed by the applicant before use.',
  '',
].join('\n');
fs.writeFileSync('dist/llms.txt', llms);

console.log(`SEO: generated ${pages.length} crawlable public snapshots, llms.txt (${latest.length} latest entries)`);

