import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('public page snapshots contain SEO headings, source links, image alt and valid schema', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scholarportal-seo-'));
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/prerender.mjs');
  try {
    fs.mkdirSync(path.join(root, 'dist'));
    fs.mkdirSync(path.join(root, 'public'));
    fs.writeFileSync(path.join(root, 'dist/index.html'),
      '<!doctype html><html><head><title>Default</title><meta name="description" content="Default"></head><body><div id="root"></div></body></html>');
    fs.writeFileSync(path.join(root, 'public/seo-pages.json'), JSON.stringify({
      base: 'https://scholarportal.site',
      pages: [
        { path: '/', title: 'Verified Global Scholarships', description: 'Browse carefully verified opportunities.' },
        { path: '/blog', title: 'Scholarship and Application Guides', description: 'Research and preparation guides.' },
        { path: '/programs', title: 'Verified Degree Programs', description: 'Browse official programs.' },
        { path: '/blog/example', title: 'Scholarship in Norway', kind: 'Article',
          description: 'Funding, deadlines and eligibility.', content: 'Application guidance.',
          image: 'https://images.example.org/campus.jpg',
          source_url: 'https://university.example.edu/scholarship', date: '2026-10-01T00:00:00Z' },
        { path: '/blog/second', title: 'Another Scholarship in Norway', kind: 'Article',
          description: 'Confirm requirements.', content: 'Guide content.', source_url: 'javascript:alert(1)' },
      ],
    }));
    const run = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    for (const route of ['/', '/blog', '/programs', '/blog/example', '/blog/second']) {
      const html = fs.readFileSync(path.join(root, 'dist', route.slice(1), 'index.html'), 'utf8');
      assert.match(html, /<article data-seo-snapshot="true">/);
      assert.match(html, /<h1>[^<]+<\/h1><p>[^<]+<\/p>/);
      assert.match(html, /<h2>About [^<]+<\/h2>/);
      assert.match(html, /<a href="\/(?:blog|programs|)"/);
      const json = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
      assert.ok(json);
      assert.equal(JSON.parse(json[1])['@context'], 'https://schema.org');
      assert.doesNotMatch(html, /href="javascript:/);
    }
    const article = fs.readFileSync(path.join(root, 'dist/blog/example/index.html'), 'utf8');
    assert.match(article, /alt="Cover image for Scholarship in Norway"/);
    assert.match(article, /href="https:\/\/university.example.edu\/scholarship"/);
    assert.match(article, /href="\/blog\/second"/);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'dist/blog/second/index.html'), 'utf8'), /<img\b/);
    assert.match(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8'), /href="https:\/\/educationusa.state.gov\/"/);
    const home = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
    assert.match(home, /Fully Funded Scholarships 2026–2027 for International Students/);
    assert.match(home, /What does a fully funded scholarship cover\?/);
    assert.match(home, /href="\/blog"/);
    const homeSchema = JSON.parse(home.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
    assert.equal(homeSchema['@type'], 'FAQPage');
    assert.equal(homeSchema.mainEntity.length, 3);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('private workspaces use HTTP noindex and remain crawlable to see that directive', () => {
  const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const vercel=JSON.parse(fs.readFileSync(path.join(here,'vercel.json'),'utf8'));
  const protectedRoutes=vercel.headers.filter(rule=>rule.headers.some(item=>item.key==='X-Robots-Tag'&&item.value.includes('noindex')));
  assert.ok(protectedRoutes.some(rule=>rule.source.includes('admin')&&rule.source.includes('settings')&&rule.source.includes('auth')),'private routes missing HTTP noindex');
  const robots=fs.readFileSync(path.join(here,'public/robots.txt'),'utf8');
  assert.doesNotMatch(robots,/^Disallow:\s*\/(?:admin|auth|settings)/m,'robots block hides noindex from crawlers');
  assert.match(robots,/^Sitemap:\s+https:\/\/scholarportal\.site\/sitemap\.xml/m);
});
