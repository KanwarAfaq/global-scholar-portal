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
    '@type': page.path === '/' ? 'FAQPage' : 'WebPage',
    name: page.title,
    description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'ScholarPortal', url: base },
    ...(page.path === '/' ? { mainEntity: homeFaqs.map(([question, answer]) => ({
      '@type': 'Question', name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })) } : {}),
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
console.log(`SEO: generated ${pages.length} crawlable public snapshots`);

