import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE = (import.meta.env.VITE_SITE_URL || 'https://scholarportal.site').replace(/\/$/, '');
const DEFAULT_IMAGE = SITE + '/favicon.svg';
const ORGANIZATION = {
  '@type': 'Organization',
  name: 'ScholarPortal',
  url: SITE,
  logo: DEFAULT_IMAGE,
};

const pages = {
  '/': {
    title: 'Verified Global Scholarships, Fellowships and Internships',
    description: 'Discover verified scholarships, fellowships, internships and degree programs worldwide, compare official sources and prepare stronger applications.',
  },
  '/blog': {
    title: 'Scholarship and Application Guides',
    description: 'Evidence-based scholarship research, deadline guidance and practical application strategies from ScholarPortal.',
  },
  '/programs': {
    title: 'Verified Degree Programs Worldwide',
    description: 'Compare verified degree programs, official admission sources, tuition information and personalized academic fit.',
  },
  '/pricing': {
    title: 'ScholarPortal Plans and Pricing',
    description: 'Compare ScholarPortal plans for opportunity discovery, application preparation and organization workflows.',
  },
  '/terms': { title: 'Terms of Service', description: 'Terms governing the use of ScholarPortal.' },
  '/privacy-policy': { title: 'Privacy Policy', description: 'How ScholarPortal handles account, profile and application data.' },
};

export function ArticleMetadata({ title, description, path, image, date, modified, author = 'ScholarPortal Editorial Team' }) {
  const url = SITE + path;
  const summary = description || title;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: summary,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: date,
    dateModified: modified || date,
    author: { '@type': 'Organization', name: author },
    publisher: ORGANIZATION,
    ...(image ? { image: [image] } : {}),
  };
  return <Helmet>
    <title>{title} | ScholarPortal</title>
    <meta name="description" content={summary} />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="canonical" href={url} />
    <meta property="og:site_name" content="ScholarPortal" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={summary} />
    <meta property="og:url" content={url} />
    {image && <meta property="og:image" content={image} />}
    <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={summary} />
    <script type="application/ld+json">{JSON.stringify(data).replace(/</g, '\\u003c')}</script>
  </Helmet>;
}

export default function PageMetadata() {
  const { pathname } = useLocation();
  if (/^\/(blog\/|opportunity\/)/.test(pathname)) return null;
  const page = pages[pathname];
  const publicPage = Boolean(page);
  const canonicalPath = pathname === '/dashboard' ? '/' : pathname;
  const title = page?.title || 'Your Workspace';
  const description = page?.description || 'Your private ScholarPortal workspace.';
  const structured = publicPage ? {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION,
      { '@type': 'WebSite', name: 'ScholarPortal', url: SITE },
      { '@type': 'WebPage', name: title, description, url: SITE + canonicalPath, isPartOf: { '@type': 'WebSite', name: 'ScholarPortal', url: SITE } },
    ],
  } : null;
  return <Helmet>
    <title>{title} | ScholarPortal</title>
    <meta name="description" content={description} />
    <meta name="robots" content={publicPage ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow,noarchive'} />
    <link rel="canonical" href={SITE + canonicalPath} />
    <meta property="og:site_name" content="ScholarPortal" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={SITE + canonicalPath} />
    <meta name="twitter:card" content="summary" />
    {structured && <script type="application/ld+json">{JSON.stringify(structured).replace(/</g, '\\u003c')}</script>}
  </Helmet>;
}

