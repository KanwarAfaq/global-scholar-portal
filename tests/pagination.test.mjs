import test from 'node:test';
import assert from 'node:assert/strict';
import { getPageItems, pageFromParam, pageRange } from '../src/lib/pagination.js';

test('page param parsing is always a safe 1-based page', () => {
  assert.equal(pageFromParam(undefined), 1);
  assert.equal(pageFromParam(null), 1);
  assert.equal(pageFromParam('abc'), 1);
  assert.equal(pageFromParam('-4'), 1);
  assert.equal(pageFromParam('0'), 1);
  assert.equal(pageFromParam('3'), 3);
  assert.equal(pageFromParam('3.9'), 3);
  assert.equal(pageFromParam('999', 12), 12);
  assert.equal(pageFromParam('5', 0), 1);
});

test('window shows first, last, current and siblings with ellipses only for 2+ hidden pages', () => {
  assert.deepEqual(getPageItems(1, 1), [1]);
  assert.deepEqual(getPageItems(2, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getPageItems(1, 20), [1, 2, 3, 4, 5, 'ellipsis-end', 20]);
  assert.deepEqual(getPageItems(10, 20), [1, 'ellipsis-start', 9, 10, 11, 'ellipsis-end', 20]);
  assert.deepEqual(getPageItems(20, 20), [1, 'ellipsis-start', 16, 17, 18, 19, 20]);
  assert.deepEqual(getPageItems(4, 20), [1, 2, 3, 4, 5, 'ellipsis-end', 20]);
  assert.deepEqual(getPageItems(5, 20), [1, 'ellipsis-start', 4, 5, 6, 'ellipsis-end', 20]);
});

test('every page/total combination is consistent, bounded and never hides a single page', () => {
  for (let total = 1; total <= 60; total++) {
    for (let current = 1; current <= total; current++) {
      const items = getPageItems(current, total, 1);
      const numbers = items.filter(i => typeof i === 'number');
      assert.ok(items.length <= 7, `too wide for ${current}/${total}: ${items}`);
      assert.deepEqual(numbers, [...new Set(numbers)].sort((a, b) => a - b), `order/dupes ${current}/${total}`);
      assert.ok(numbers.includes(1) && numbers.includes(total) && numbers.includes(current), `missing anchor ${current}/${total}`);
      items.forEach((item, i) => {
        if (typeof item !== 'string') return;
        const gap = items[i + 1] - items[i - 1] - 1;
        assert.ok(gap >= 2, `ellipsis hides only ${gap} page(s) at ${current}/${total}`);
      });
    }
  }
});

test('out-of-range inputs are clamped instead of throwing', () => {
  assert.deepEqual(getPageItems(99, 3), [1, 2, 3]);
  assert.deepEqual(getPageItems(0, 3), [1, 2, 3]);
  assert.deepEqual(getPageItems(NaN, NaN), [1]);
});

test('range label for the last partial page and empty results', () => {
  assert.deepEqual(pageRange(1, 9, 74), { from: 1, to: 9 });
  assert.deepEqual(pageRange(9, 9, 74), { from: 73, to: 74 });
  assert.deepEqual(pageRange(1, 9, 0), { from: 0, to: 0 });
});
