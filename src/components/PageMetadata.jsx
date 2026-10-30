import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { shortenTitle } from '../lib/seoTitle';

const SITE = (import.meta.env.VITE_SITE_URL || 'https://scholarportal.site').replace(/\/$/, '');
// Social previews and rich results need a raster image (SVG favicons are ignored by most platforms).
const DEFAULT_IMAGE = SITE + '/og-default.jpg';
const LOGO = { '@type': 'ImageObject', url: SITE + '/logo-512.png', width: 512, height: 512 };
const ORGANIZATION = {
  '@type': 'Organization',
  '@id': SITE + '/#organization',
  name: 'ScholarPortal',
  url: SITE + '/',
  logo: LOGO,
};
const WEBSITE = {
  '@type': 'WebSite',
  '@id': SITE + '/#website',
  name: 'ScholarPortal',
  url: SITE + '/',
  inLanguage: 'en',
  publisher: { '@id': SITE + '/#organization' },
  // The homepage genuinely supports /?q=term (the search box is pre-filled and filtered from it).
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: SITE + '/?q={search_term_string}' },
    'query-input': 'required name=search_term_string',
  },
};

// The prerendered snapshot may point a near-duplicate page at its primary page (canonical + distinct title).
// Remember that on first load so hydration does not undo it.
const PRERENDERED = typeof document !== 'undefined' ? {
  path: window.location.pathname,
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
  title: document.title || null,
} : null;

const pages = {
  '/': {
    title: 'Fully Funded Scholarships 2026–2027 for International Students',
    description: 'Explore fully funded scholarships 2026–2027 for international students, including master’s, PhD, fellowships and internships. Compare eligibility, funding, deadlines and official sources.',
  },
  '/blog': {
    title: 'Scholarship Application Guides 2026–2027',
    description: 'Scholarship application guides for international students: eligibility, personal statements, funding, deadlines and how to apply for study abroad scholarships.',
  },
  '/programs': {
    title: 'Study Abroad Degree Programs for International Students',
    description: 'Find study abroad degree programs for international students, compare academic admission requirements, tuition, funding and official university sources.',
  },
  '/pricing': {
    title: 'ScholarPortal Plans and Pricing',
    description: 'Compare ScholarPortal plans for opportunity discovery, application preparation and organization workflows.',
  },
  '/terms': { title: 'Terms of Service', description: 'Terms governing the use of ScholarPortal.' },
  '/privacy-policy': { title: 'Privacy Policy', description: 'How ScholarPortal handles account, profile and application data.' },
};

export function ArticleMetadata({
  title,
  description,
  path,
  image,
  date,
  modified,
  author = 'ScholarPortal Editorial Team',
  indexable = true,
}) {
  const url = SITE + path;
  const summary = description || title;
  const pre = PRERENDERED && PRERENDERED.path === path && PRERENDERED.canonical && PRERENDERED.canonical !== url ? PRERENDERED : null;
  const canonicalUrl = pre ? pre.canonical : url;
  const headTitle = shortenTitle(title, 60);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: summary,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: date,
    dateModified: modified || date,
    inLanguage: 'en',
    isAccessibleForFree: true,
    author: { '@type': 'Organization', name: author },
    publisher: ORGANIZATION,
    image: [image || DEFAULT_IMAGE],
  };
  const crumbs = [
    { name: 'Home', path: '/' },
    ...(path.startsWith('/blog/') || path.startsWith('/guides/') ? [{ name: 'Application guides', path: '/blog' }] : []),
    { name: title, path },
  ];
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: SITE + crumb.path })),
  };

  return <Helmet>
    <title>{pre?.title || `${headTitle} | ScholarPortal`}</title>
    <meta name="description" content={summary} />
    <meta
      name="robots"
      content={indexable
        ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
        : 'noindex,follow,noarchive'}
    />
    {indexable && <link rel="canonical" href={canonicalUrl} />}
    <meta property="og:site_name" content="ScholarPortal" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content={headTitle} />
    <meta property="og:description" content={summary} />
    {indexable && <meta property="og:url" content={canonicalUrl} />}
    <meta property="og:locale" content="en_US" />
    <meta property="og:image" content={image || DEFAULT_IMAGE} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={headTitle} />
    <meta name="twitter:description" content={summary} />
    <meta name="twitter:image" content={image || DEFAULT_IMAGE} />
    {indexable && <script type="application/ld+json">{JSON.stringify(data).replace(/</g, '\\u003c')}</script>}
    {indexable && <script type="application/ld+json">{JSON.stringify(breadcrumbs).replace(/</g, '\\u003c')}</script>}
  </Helmet>;
}

export default function PageMetadata() {
  const { pathname, search } = useLocation();
  if (/^\/(blog\/|opportunity\/|guides\/)/.test(pathname)) return null;

  const page = pages[pathname];
  const publicPage = Boolean(page);
  // Paginated listings (?page=N) are distinct pages: give each its own title and self-referencing canonical.
  const listingPage = Number.parseInt(new URLSearchParams(search).get('page') || '1', 10);
  const pageNumber = (pathname === '/' || pathname === '/blog') && Number.isFinite(listingPage) && listingPage > 1 ? listingPage : 1;
  const title = (page?.title || 'Your Workspace') + (pageNumber > 1 ? ` – Page ${pageNumber}` : '');
  const description = page?.description || 'Your private ScholarPortal workspace.';
  const canonical = publicPage ? SITE + pathname + (pageNumber > 1 ? `?page=${pageNumber}` : '') : null;
  const structured = publicPage ? {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION,
      WEBSITE,
      {
        '@type': 'WebPage',
        name: title,
        description,
        url: canonical,
        inLanguage: 'en',
        isPartOf: { '@id': SITE + '/#website' },
      },
      ...(pathname === '/' ? [] : [{
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: page.title, item: SITE + pathname },
        ],
      }]),
    ],
  } : null;

  return <Helmet>
    <title>{title} | ScholarPortal</title>
    <meta name="description" content={description} />
    <meta
      name="robots"
      content={publicPage
        ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
        : 'noindex,follow,noarchive'}
    />
    {canonical && <link rel="canonical" href={canonical} />}
    <meta property="og:site_name" content="ScholarPortal" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={DEFAULT_IMAGE} />
    {canonical && <meta property="og:url" content={canonical} />}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={DEFAULT_IMAGE} />
    {structured && <script type="application/ld+json">{JSON.stringify(structured).replace(/</g, '\\u003c')}</script>}
  </Helmet>;
}
