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
    <meta
      name="robots"
      content={indexable
        ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
        : 'noindex,follow,noarchive'}
    />
    {indexable && <link rel="canonical" href={url} />}
    <meta property="og:site_name" content="ScholarPortal" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={summary} />
    {indexable && <meta property="og:url" content={url} />}
    {image && <meta property="og:image" content={image} />}
    <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={summary} />
    {indexable && <script type="application/ld+json">{JSON.stringify(data).replace(/</g, '\\u003c')}</script>}
  </Helmet>;
}

export default function PageMetadata() {
  const { pathname } = useLocation();
  if (/^\/(blog\/|opportunity\/)/.test(pathname)) return null;

  const page = pages[pathname];
  const publicPage = Boolean(page);
  const title = page?.title || 'Your Workspace';
  const description = page?.description || 'Your private ScholarPortal workspace.';
  const canonical = publicPage ? SITE + pathname : null;
  const structured = publicPage ? {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION,
      { '@type': 'WebSite', name: 'ScholarPortal', url: SITE },
      {
        '@type': 'WebPage',
        name: title,
        description,
        url: canonical,
        isPartOf: { '@type': 'WebSite', name: 'ScholarPortal', url: SITE },
      },
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
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    {canonical && <meta property="og:url" content={canonical} />}
    <meta name="twitter:card" content="summary" />
    {structured && <script type="application/ld+json">{JSON.stringify(structured).replace(/</g, '\\u003c')}</script>}
  </Helmet>;
}
