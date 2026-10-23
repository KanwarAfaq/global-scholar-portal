import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LONG = 'Fully funded scholarship details for international students including tuition, living allowance, travel grant, health insurance and research costs. '.repeat(3);

function build(pages) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scholarportal-seo2-'));
  fs.mkdirSync(path.join(root, 'dist')); fs.mkdirSync(path.join(root, 'public'));
  fs.writeFileSync(path.join(root, 'dist/index.html'), '<!doctype html><html lang="en"><head><title>Default</title><script type="application/ld+json">{"@type":"WebSite"}</script></head><body><div id="root"></div></body></html>');
  fs.writeFileSync(path.join(root, 'public/seo-pages.json'), JSON.stringify({ base: 'https://scholarportal.site', pages }));
  const run = spawnSync(process.execPath, [path.join(here, 'scripts/prerender.mjs')], { cwd: root, encoding: 'utf8' });
  return { root, run, read: p => fs.readFileSync(path.join(root, 'dist', p), 'utf8'), done: () => fs.rmSync(root, { recursive: true, force: true }) };
}
const blocks = html => [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(m => JSON.parse(m[1]));
const pages = [
  { path: '/', title: 'Home', description: 'Home description.' },
  { path: '/blog', title: 'Guides', description: 'Guides description.' },
  { path: '/blog/with-image', title: 'Scholarship With Cover', kind: 'Article', description: LONG, content: 'Body.', image: 'https://images.example.org/cover.jpg', date: '2026-10-01T00:00:00Z', modified: '2026-10-05T00:00:00Z' },
  { path: '/blog/no-image', title: 'Scholarship Without Cover', kind: 'Article', description: 'Short summary.', content: 'Body.', date: '2026-10-02T00:00:00Z' },
  { path: '/opportunity/abc/blog', title: 'Scholarship Without Cover', kind: 'Article', description: 'Same title as another page.', content: 'Body.', date: '2026-10-03T00:00:00Z' },
];

test('every page gets a default social image, large twitter card and a clamped description', () => {
  const b = build(pages);
  try {
    assert.equal(b.run.status, 0, b.run.stderr);
    for (const route of ['index.html', 'blog/index.html', 'blog/with-image/index.html', 'blog/no-image/index.html']) {
      const html = b.read(route);
      assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+\.(?:jpg|png)">/, route);
      assert.match(html, /<meta name="twitter:card" content="summary_large_image">/, route);
      assert.match(html, /<meta name="twitter:title" content="[^"]+">/, route);
      assert.match(html, /<meta name="twitter:image" content="https:\/\/[^"]+">/, route);
      assert.match(html, /<meta property="og:locale" content="en_US">/, route);
      const description = html.match(/<meta name="description" content="([^"]*)">/)[1];
      assert.ok(description.length <= 160, `description ${description.length} chars in ${route}`);
    }
    // default image only where the page has none; real cover images are preserved
    assert.match(b.read('blog/no-image/index.html'), /og:image" content="https:\/\/scholarportal\.site\/og-default\.jpg"/);
    assert.match(b.read('blog/no-image/index.html'), /og:image:width" content="1200"/);
    assert.match(b.read('blog/with-image/index.html'), /og:image" content="https:\/\/images\.example\.org\/cover\.jpg"/);
    assert.doesNotMatch(b.read('blog/with-image/index.html'), /og:image:width/);
    // clamped descriptions end cleanly instead of mid-word
    const long = b.read('blog/with-image/index.html').match(/<meta name="description" content="([^"]*)">/)[1];
    assert.match(long, /…$/);
  } finally { b.done(); }
});

test('articles carry image, language and a publisher logo in a raster format; graph has Organization, WebSite search and breadcrumbs', () => {
  const b = build(pages);
  try {
    const html = b.read('blog/no-image/index.html');
    const [primary, graph] = blocks(html);
    assert.equal(primary['@type'], 'Article');
    assert.deepEqual(primary.image, ['https://scholarportal.site/og-default.jpg']);
    assert.equal(primary.inLanguage, 'en');
    assert.match(primary.publisher.logo.url, /\.png$/);
    const types = graph['@graph'].map(n => n['@type']);
    assert.deepEqual(types, ['Organization', 'WebSite', 'BreadcrumbList']);
    const site = graph['@graph'][1];
    assert.equal(site.potentialAction['@type'], 'SearchAction');
    assert.equal(site.potentialAction.target.urlTemplate, 'https://scholarportal.site/?q={search_term_string}');
    const crumbs = graph['@graph'][2].itemListElement;
    assert.deepEqual(crumbs.map(c => c.position), [1, 2, 3]);
    assert.equal(crumbs[1].item, 'https://scholarportal.site/blog');
    assert.equal(crumbs[2].item, 'https://scholarportal.site/blog/no-image');
    // the first JSON-LD block keeps the page's own type, and the homepage has no one-item breadcrumb
    assert.equal(blocks(b.read('index.html'))[0]['@type'], 'FAQPage');
    assert.deepEqual(blocks(b.read('index.html'))[1]['@graph'].map(n => n['@type']), ['Organization', 'WebSite']);
  } finally { b.done(); }
});

test('snapshots show a visible breadcrumb and a dated byline for articles', () => {
  const b = build(pages);
  try {
    const html = b.read('blog/with-image/index.html');
    assert.match(html, /<nav aria-label="Breadcrumb"><a href="\/">Home<\/a> › <a href="\/blog">Application guides<\/a> › <span>/);
    assert.match(html, /By ScholarPortal Editorial Team · Published <time datetime="2026-10-01T00:00:00Z">2026-10-01<\/time> · Updated <time datetime="2026-10-05T00:00:00Z">2026-10-05<\/time>/);
    assert.doesNotMatch(b.read('index.html'), /aria-label="Breadcrumb"/);
  } finally { b.done(); }
});

test('build reports duplicate titles without failing, and writes a fresh llms.txt', () => {
  const b = build(pages);
  try {
    assert.equal(b.run.status, 0);
    assert.match(b.run.stderr, /1 title\(s\) are shared by multiple pages/);
    assert.match(b.run.stderr, /\/blog\/no-image, \/opportunity\/abc\/blog/);
    const llms = b.read('llms.txt');
    assert.match(llms, /^# ScholarPortal/);
    assert.match(llms, /Coverage: 3 public guides and opportunity reports; most recent published 2026-10-03/);
    assert.match(llms, /\[Scholarship Without Cover\]\(https:\/\/scholarportal\.site\/opportunity\/abc\/blog\)/);
    assert.match(llms, /\[XML sitemap\]\(https:\/\/scholarportal\.site\/sitemap\.xml\)/);
    // newest first
    assert.ok(llms.indexOf('/opportunity/abc/blog') < llms.indexOf('/blog/with-image'));
  } finally { b.done(); }
});

test('brand images exist, titles keep the brand only when they fit', () => {
  for (const [file, minBytes, maxBytes] of [['public/og-default.jpg', 5000, 300000], ['public/logo-512.png', 1000, 100000]]) {
    const size = fs.statSync(path.join(here, file)).size;
    assert.ok(size > minBytes && size < maxBytes, `${file} is ${size} bytes`);
  }
  // (landing pages '/', '/blog', '/programs' get their titles from the landingSeo map, so use article pages here)
  const b = build([
    { path: '/', title: 'Home', description: 'd' },
    { path: '/blog/short', title: 'Short title', kind: 'Article', description: 'd', date: '2026-10-01T00:00:00Z' },
    { path: '/blog/long', title: 'A very long scholarship guide title that already fills the whole search result width and more', kind: 'Article', description: 'd', date: '2026-10-01T00:00:00Z' },
  ]);
  try {
    assert.match(b.read('blog/short/index.html'), /<title>Short title \| ScholarPortal<\/title>/);
    const longTitle = b.read('blog/long/index.html').match(/<title>([^<]*)<\/title>/)[1];
    assert.ok(!longTitle.endsWith('| ScholarPortal') && longTitle.startsWith('A very long scholarship guide title'), longTitle);
  } finally { b.done(); }
});

test('robots.txt welcomes retrieval crawlers, never hides noindex, and llms.txt points at core pages', () => {
  const robots = fs.readFileSync(path.join(here, 'public/robots.txt'), 'utf8');
  for (const agent of ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'PerplexityBot']) assert.match(robots, new RegExp(`User-agent: ${agent}\\nAllow: /`));
  assert.doesNotMatch(robots, /^Disallow:/m);
  assert.match(robots, /^Sitemap: https:\/\/scholarportal\.site\/sitemap\.xml$/m);
  const llms = fs.readFileSync(path.join(here, 'public/llms.txt'), 'utf8');
  for (const route of ['/blog', '/programs', '/sitemap.xml']) assert.ok(llms.includes('https://scholarportal.site' + route), route);
});
