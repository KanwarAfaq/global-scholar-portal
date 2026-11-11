// Generate crawlable public HTML snapshots without exposing private workspace data.
import fs from 'node:fs';
import path from 'node:path';
import { parseInline, plainText } from '../src/lib/guideMarkup.js';
import { shortenTitle, findDuplicateTitles } from '../src/lib/seoTitle.js';
import { isKnownBrokenArticleImage } from '../src/lib/articleImages.js';

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
// Lightweight, build-time article directory for the React listing when the database is temporarily unavailable.
// Only entries already approved for the public SEO manifest are exposed.
const blogFallback = pages.filter(p => p.kind === 'Article' && p.path.startsWith('/blog/'))
  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  .slice(0, 36).map(p => ({
    id: 'seo-' + p.path.slice('/blog/'.length),
    slug: p.path.slice('/blog/'.length),
    title: String(p.title || 'Article'),
    excerpt: String(p.description || '').slice(0, 240),
    created_at: p.date || null,
    image: typeof p.image === 'string' ? p.image : (p.image?.url || ''),
    tags: [], read_time: 'Guide'
  }));
fs.writeFileSync('dist/blog-fallback.json', JSON.stringify({posts:blogFallback}), 'utf8');

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
  if (page.path.startsWith('/blog/') || page.path.startsWith('/guides/')) return [home, { name: 'Application guides', path: '/blog' }, { name: page.title, path: page.path }];
  return [home, { name: page.title, path: page.path }];
};
const removeManagedHead = html => html
  .replace(/<title>[\s\S]*?<\/title>/gi, '')
  .replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*>/gi, '')
  .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
  .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');


const inlineHtml = value => parseInline(value).map(part => part.href
  ? '<a href="' + escape(part.href) + '"' + (part.href.startsWith('/') ? '' : ' rel="noopener noreferrer"') + '>' + escape(part.text) + '</a>'
  : escape(part.text)).join('');
const guideBody = page => page.sections.map(section => '<section><h2>' + escape(section.h) + '</h2>' +
  (section.p || []).slice(0, section.ul || section.ol ? 1 : undefined).map(t => '<p>' + inlineHtml(t) + '</p>').join('') +
  (section.ul ? '<ul>' + section.ul.map(t => '<li>' + inlineHtml(t) + '</li>').join('') + '</ul>' : '') +
  (section.ol ? '<ol>' + section.ol.map(t => '<li>' + inlineHtml(t) + '</li>').join('') + '</ol>' : '') +
  ((section.ul || section.ol) ? (section.p || []).slice(1).map(t => '<p>' + inlineHtml(t) + '</p>').join('') : '') + '</section>').join('') +
  (page.faqs ? '<section aria-labelledby="guide-faq"><h2 id="guide-faq">Frequently asked questions</h2>' +
    page.faqs.map(([q, a]) => '<div><h3>' + escape(q) + '</h3><p>' + inlineHtml(a) + '</p></div>').join('') + '</section>' : '');

const validWebUrl = value => {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value.trim());
    return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : null;
  } catch { return null; }
};
const relatedLinks = page => {
  if (page.related) return [...page.related, '/', '/programs'].filter((p, i, all) => all.indexOf(p) === i && p !== page.path)
    .map(p => ({ path: p, label: pages.find(item => item.path === p)?.title || (p === '/' ? 'Browse verified scholarships' : 'Verified degree programs') }));
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
// Crawlable, page-sized directory: do not hide hundreds of older articles behind
// a client-only listing or cap the discoverable HTML links at 250.
const articleDirectoryPages = () => {
  const articles = pages.filter(item => item.kind === 'Article' && !duplicateOf.has(item.path) && !redirectedPaths.has(item.path))
    .sort((left,right) => String(right.date||'').localeCompare(String(left.date||'')) || left.path.localeCompare(right.path));
  const batches = [];
  for(let i=0;i<articles.length;i+=100)batches.push(articles.slice(i,i+100));
  return batches;
};
// Link each public article from a crawlable HTML hub, not solely from XML sitemaps.
// Google's crawler can follow these anchors even if client-side data requests fail.
const hubLinks = page => {
  if (page.path !== '/' && page.path !== '/blog') return '';
  const articles = pages.filter(item => item.kind === 'Article')
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')));
  const sections = [
    { heading: 'Scholarship application guides', items: articles.filter(item => item.path.startsWith('/blog/')) },
    { heading: 'ScholarPortal study guides', items: articles.filter(item => item.path.startsWith('/guides/')) },
    { heading: 'Scholarship and opportunity reports', items: articles.filter(item => item.path.startsWith('/opportunity/')) },
  ];
  const limit = page.path === '/' ? 12 : 100;
  const lists = sections.map(section => {
    const links = section.items.slice(0, limit);
    if (!links.length) return '';
    return '<section><h2>' + escape(section.heading) + '</h2><ul>' +
      links.map(link => '<li><a href="' + escape(link.path) + '">' + escape(link.title) + '</a></li>').join('') +
      '</ul></section>';
  }).filter(Boolean);
  const directory = page.path === '/blog' ? '<p><strong>Complete article archive:</strong> ' +
    articleDirectoryPages().map((_,i)=>'<a href="/article-directory/'+(i+1)+'">Archive page '+(i+1)+'</a>').join(' · ') + '</p>' : '';
  return lists.length ? '<nav aria-label="Browse public scholarship articles" data-seo-article-hub="true">' +
    lists.join('') + directory + '</nav>' : directory;
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
    ? { url, label: 'Source article or application information' }
    : (officialResources[page.path] || null);
};

// Keep crawlable HTML titles synchronized even before the next scheduled sitemap refresh.
const landingSeo = {
  '/': {
    title: 'Fully Funded Scholarships 2026–2027 | Study Abroad',
    description: 'Find fully funded scholarships 2026–2027 for international students: master’s, PhD and fellowships. Compare eligibility, deadlines and official sources.',
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
// Pages sharing a title: the first stays primary, the rest canonicalise to it and get a distinct title.
const duplicateOf = findDuplicateTitles(pages);

// Produce the deployed sitemap from the SAME canonical decisions as the HTML.
// Previously public/sitemap.xml listed duplicate-title variants as indexable URLs,
// while their prerendered <link rel="canonical"> pointed elsewhere. Sitemap entries
// should identify only canonical URLs, and a Vercel redirect must not be included.
const vercelConfigPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../vercel.json');
const redirects = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8')).redirects || [];
const redirectedPaths = new Set(redirects.filter(r => r.source && r.destination && r.source.startsWith('/') && r.destination.startsWith('/')).map(r => r.source));
const xmlEscape = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[c]));
const sitemapEntries = pages.filter(page => !duplicateOf.has(page.path) && !redirectedPaths.has(page.path))
  .map(page => {
    const lastmod = page.date && !Number.isNaN(Date.parse(page.date)) ? `<lastmod>${xmlEscape(page.date)}</lastmod>` : '';
    return `<url><loc>${xmlEscape(siteUrl + page.path)}</loc>${lastmod}</url>`;
  });
fs.writeFileSync('dist/sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  sitemapEntries.join('') + '</urlset>\n');
console.log(`SEO: sitemap contains ${sitemapEntries.length} canonical URLs; excluded ${duplicateOf.size} duplicate-title variants and ${pages.filter(p => redirectedPaths.has(p.path) && !duplicateOf.has(p.path)).length} redirected routes.`);
// Shortening can make two different titles identical; those keep their full (unique) title instead.
const shortKey = page => {
  const dup = duplicateOf.get(page.path);
  return shortenTitle(landingSeo[page.path]?.title || page.title, 60 - (dup ? dup.titleSuffix.length : 0)) + (dup ? dup.titleSuffix : '');
};
const shortCounts = new Map();
for (const page of pages) shortCounts.set(shortKey(page).toLowerCase(), (shortCounts.get(shortKey(page).toLowerCase()) || 0) + 1);
for (const page of pages) {
  if (landingSeo[page.path]) Object.assign(page, landingSeo[page.path]);
  if (!page.path.startsWith('/') || page.path.includes('..')) throw new Error('Unsafe SEO path');
  const canonical = base + page.path;
  const dup = duplicateOf.get(page.path);
  const canonicalHref = base + (dup ? dup.canonicalPath : page.path);
  const shortened = shortKey(page);
  const headTitle = shortCounts.get(shortened.toLowerCase()) > 1 ? text(page.title) + (dup ? dup.titleSuffix : '') : shortened;
  const description = text(page.description || page.title);
  const metaDescription = clamp(description, 152);
  const ownImage = isKnownBrokenArticleImage(page.image) ? null : validWebUrl(page.image);
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
    author: { '@type': 'Organization', name: 'ScholarPortal Editorial Team', url: siteUrl + '/', logo: { '@type': 'ImageObject', url: LOGO.url, width: LOGO.width, height: LOGO.height } },
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
  const faqSchema = page.faqs ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plainText(a) } })) } : null;
  const head = [
    `<title>${escape(metaTitle(headTitle))}</title>`,
    `<meta name="description" content="${escape(metaDescription)}">`,
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    `<link rel="canonical" href="${escape(canonicalHref)}">`,
    '<meta property="og:site_name" content="ScholarPortal">',
    `<meta property="og:type" content="${article ? 'article' : 'website'}">`,
    article && published ? `<meta property="article:published_time" content="${escape(published)}">` : '',
    article && modified ? `<meta property="article:modified_time" content="${escape(modified)}">` : '',
    article ? '<meta property="article:author" content="ScholarPortal Editorial Team">' : '',
    `<meta property="og:title" content="${escape(headTitle)}">`,
    `<meta property="og:description" content="${escape(metaDescription)}">`,
    `<meta property="og:url" content="${escape(canonicalHref)}">`,
    '<meta property="og:locale" content="en_US">',
    `<meta property="og:image" content="${escape(socialImage)}">`,
    ownImage ? '' : `<meta property="og:image:width" content="${DEFAULT_IMAGE.width}"><meta property="og:image:height" content="${DEFAULT_IMAGE.height}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:alt" content="${escape(DEFAULT_IMAGE.alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escape(headTitle)}">`,
    `<meta name="twitter:description" content="${escape(metaDescription)}">`,
    `<meta name="twitter:image" content="${escape(socialImage)}">`,
    `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>`,
    faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema).replace(/</g, '\\u003c')}</script>` : '',
    `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('');
  const bodyText = text(page.content || '');
  const lead = description.toLowerCase().includes(keyword.toLowerCase())
    ? description : keyword + ' — ' + description;
  const imageUrl = ownImage;
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
    page.sections ? '<h2>' + escape('About ' + keyword) + '</h2>' + guideBody(page) : '<h2>' + escape('About ' + keyword) + '</h2>',
    !page.sections && bodyText && bodyText !== description ? '<div>' + escape(bodyText) + '</div>' : '',
    page.path === '/programs' ? [
      "<section aria-labelledby=\"program-guide-heading\"><h2 id=\"program-guide-heading\">How to compare international degree programs</h2>",
      "<p>Start with the subject, degree level and entry term that match your goals. University admission criteria can differ substantially even when program names sound similar. Check the official department site for academic prerequisites, transcripts, language-test conditions, recommendation letters and application fees. Requirements and deadlines can change between admission cycles.</p>",
      "<h3>Tuition, scholarships and living costs</h3>",
      "<p>Evaluate the full cost of attendance rather than relying only on tuition. Consider housing, health insurance, travel, visa requirements and daily expenses. A tuition waiver, stipend, assistantship and fully funded scholarship are not interchangeable. Verify whether funding is automatic, requires a separate application, or depends on a supervisor or department nomination.</p>",
      "<h3>Research degrees and supervisor fit</h3>",
      "<p>For a research-based master's or PhD program, investigate faculty areas, available laboratories, research facilities and whether contacting a potential supervisor is expected. Look for an official admissions FAQ instead of guessing which documents are compulsory. Some universities request a statement of purpose or a research proposal; others ask for a portfolio, standardized tests or interviews. Always check whether translated transcripts, certificates or degree equivalency documents are needed, and allow time for references to be submitted before the official deadline.</p>",
      "<h3>Application planning</h3>",
      "<p>Make a shortlist using official university pages and record each program\\u0027s eligibility, deadline, required documents and funding status. Confirm that a program is currently accepting applications before sending documents or sharing personal information. For general preparation, read <a href=\"/blog\">scholarship application guides</a> and compare <a href=\"/\">verified opportunities</a> with the university\\u0027s official instructions.</p></section>"
    ].join('') : '',
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

// Generate crawlable, canonical article-directory pages from exactly the same
// non-duplicate, non-redirected public articles that appear in the sitemap.
const directoryBatches = articleDirectoryPages();
for(let i=0;i<directoryBatches.length;i++){
  const route='/article-directory/'+(i+1),url=siteUrl+route;
  const links=directoryBatches[i].map(item=>'<li><a href="'+escape(item.path)+'">'+escape(item.title)+'</a></li>').join('');
  const pagination='<nav aria-label="Article archive pages">'+directoryBatches.map((_,n)=>'<a href="/article-directory/'+(n+1)+'"'+(n===i?' aria-current="page"':'')+'>Page '+(n+1)+'</a>').join(' · ')+'</nav>';
  const title='Scholarship Article Archive — Page '+(i+1)+' | ScholarPortal';
  const summary='Browse published scholarship, fellowship and study-abroad application articles in the ScholarPortal archive, page '+(i+1)+'.';
  const structured={ '@context':'https://schema.org','@type':'CollectionPage',name:title,url,description:summary,
    isPartOf:{'@type':'WebSite',name:'ScholarPortal',url:siteUrl+'/' }};
  const head='<title>'+escape(title)+'</title>'+
    '<meta name="description" content="'+escape(summary)+'">'+
    '<meta name="robots" content="index,follow">'+
    '<link rel="canonical" href="'+escape(url)+'">'+
    '<script type="application/ld+json">'+JSON.stringify(structured).replace(/</g,'\\u003c')+'</script>';
  const html=removeManagedHead(template).replace('</head>',head+'</head>').replace('<div id="root"></div>',
    '<div id="root"><main><nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/blog">Application guides</a></nav>'+
    '<h1>Scholarship Article Archive — Page '+(i+1)+'</h1><p>'+escape(summary)+'</p>'+
    pagination+'<ul>'+links+'</ul>'+pagination+'</main></div>');
  const destination=path.join('dist',route.slice(1),'index.html');
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,html);
}
// Add the directory pages to the same canonical sitemap generated above.
if(directoryBatches.length){
  const xml=fs.readFileSync('dist/sitemap.xml','utf8');
  const extra=directoryBatches.map((_,i)=>'<url><loc>'+xmlEscape(siteUrl+'/article-directory/'+(i+1))+'</loc></url>').join('');
  fs.writeFileSync('dist/sitemap.xml',xml.replace('</urlset>',extra+'</urlset>'));
}

// Report what was consolidated so the editorial team can merge or 301 the near-identical pages.
if (duplicateOf.size) {
  console.warn(`SEO: ${duplicateOf.size} page(s) duplicate another page's title; each now canonicalises to its primary page and has a distinct title. Consider merging or redirecting:`);
  for (const [dupPath, { canonicalPath }] of [...duplicateOf].slice(0, 20)) console.warn(`  - ${dupPath} → ${canonicalPath}`);
  if (duplicateOf.size > 20) console.warn(`  … and ${duplicateOf.size - 20} more`);
}

// llms.txt for answer engines / AI crawlers: regenerated every build from the real manifest so the
// "latest" list never goes stale. Plain facts only; nothing here is a ranking or traffic claim.
const mdSafe = value => String(value || '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
const latest = pages.filter(page => page.kind === 'Article' && !page.path.startsWith('/guides/') && page.date && !Number.isNaN(Date.parse(page.date)))
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
  ...(pages.some(page => page.path.startsWith('/guides/')) ? ['## Study guides',
    ...pages.filter(page => page.path.startsWith('/guides/')).map(page => `- [${mdSafe(page.title)}](${siteUrl}${page.path}): ${mdSafe(clamp(text(page.description || ''), 140))}`), ''] : []),
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

