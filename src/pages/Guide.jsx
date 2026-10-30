import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import data from '../content/guides.json';
import { ArticleMetadata } from '../components/PageMetadata';
import { parseInline, isInternal, plainText } from '../lib/guideMarkup';
import NotFound from './NotFound';

function Inline({ text }) {
  return parseInline(text).map((part, index) => {
    if (!part.href) return <React.Fragment key={index}>{part.text}</React.Fragment>;
    return isInternal(part.href)
      ? <Link key={index} to={part.href}>{part.text}</Link>
      : <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>;
  });
}

export default function Guide() {
  const { slug } = useParams();
  const guide = data.guides.find(item => item.slug === slug);
  if (!guide) return <NotFound />;
  const path = '/guides/' + guide.slug;
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faqs.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: plainText(answer) } })),
  };
  const related = (guide.related || []).map(href => data.guides.find(item => '/guides/' + item.slug === href)).filter(Boolean);
  return (
    <article className="max-w-3xl mx-auto prose dark:prose-invert">
      <ArticleMetadata title={guide.title} description={guide.description} path={path} date={data.date} modified={data.date} />
      <Helmet><script type="application/ld+json">{JSON.stringify(faqSchema).replace(/</g, '\\u003c')}</script></Helmet>
      <nav aria-label="Breadcrumb" className="text-sm not-prose text-slate-500">
        <Link to="/" className="hover:underline">Home</Link> › <Link to="/blog" className="hover:underline">Application guides</Link> › <span>{guide.title}</span>
      </nav>
      <h1>{guide.title}</h1>
      <p className="lead"><Inline text={guide.description} /></p>
      <p><small>By ScholarPortal Editorial Team · Updated <time dateTime={data.date}>{data.date}</time></small></p>
      {guide.sections.map(section => (
        <section key={section.h}>
          <h2>{section.h}</h2>
          {(section.p || []).slice(0, section.ul || section.ol ? 1 : undefined).map((text, i) => <p key={i}><Inline text={text} /></p>)}
          {section.ul && <ul>{section.ul.map(item => <li key={item}><Inline text={item} /></li>)}</ul>}
          {section.ol && <ol>{section.ol.map(item => <li key={item}><Inline text={item} /></li>)}</ol>}
          {(section.ul || section.ol) && (section.p || []).slice(1).map((text, i) => <p key={i}><Inline text={text} /></p>)}
        </section>
      ))}
      <section aria-labelledby="guide-faq">
        <h2 id="guide-faq">Frequently asked questions</h2>
        {guide.faqs.map(([question, answer]) => <div key={question}><h3>{question}</h3><p><Inline text={answer} /></p></div>)}
      </section>
      <nav aria-label="Related ScholarPortal pages">
        <h2>Keep exploring</h2>
        <ul>
          <li><Link to="/">Browse verified scholarships</Link></li>
          <li><Link to="/programs">Compare degree programs</Link></li>
          {related.map(item => <li key={item.slug}><Link to={'/guides/' + item.slug}>{item.title}</Link></li>)}
        </ul>
      </nav>
      <p><small>Details such as funding, eligibility and dates change. Always confirm them on the official provider page. Last reviewed {data.date}.</small></p>
    </article>
  );
}
