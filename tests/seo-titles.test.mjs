import test from 'node:test';
import assert from 'node:assert/strict';
import { shortenTitle, findDuplicateTitles } from '../src/lib/seoTitle.js';

test('short titles are untouched', () => {
  assert.equal(shortenTitle('KAIST Scholarship 2027'), 'KAIST Scholarship 2027');
});

test('long titles are cut at a subtitle separator when possible', () => {
  const t = 'Study in China with the CSC Scholarship 2027 – Fully Funded Master & PhD Opportunities';
  assert.equal(shortenTitle(t), 'Study in China with the CSC Scholarship 2027');
});

test('long titles without a separator are cut on a word boundary and never end on a stopword', () => {
  const t = 'International Graduate Admissions at UC Santa Cruz Including Eligibility and Funding for Students';
  const out = shortenTitle(t, 60);
  assert.ok(out.length <= 60, out);
  assert.ok(t.startsWith(out), out);
  assert.doesNotMatch(out, /\s(and|for|of|in|the|to|with)$/i);
});

test('every title fits the limit', () => {
  for (const t of ['A'.repeat(120), 'word '.repeat(40), 'Fully Funded Danish Government Scholarship for International Master\'s Students']) {
    assert.ok(shortenTitle(t, 60).length <= 60);
  }
});

test('duplicate titles keep the first page primary and point the rest at it', () => {
  const map = findDuplicateTitles([
    { path: '/a', title: 'Same Title' }, { path: '/b', title: 'same title ' }, { path: '/c', title: 'Other' }, { path: '/d', title: 'Same Title' },
  ]);
  assert.equal(map.has('/a'), false);
  assert.deepEqual(map.get('/b'), { canonicalPath: '/a', titleSuffix: ' (Version 2)' });
  assert.deepEqual(map.get('/d'), { canonicalPath: '/a', titleSuffix: ' (Version 3)' });
  assert.equal(map.size, 2);
});
