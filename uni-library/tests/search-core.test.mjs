import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, tokenize, buildIndex, search } from '../src/lib/search-core.js';

const make = (over) => ({
  id: 'x', title: 'T', course: 'cse101', courseCode: 'CSE101', courseTitle: 'Introduction to Programming',
  type: 'notes', typeLabel: 'Notes', semester: 'Fall 2026', description: '', addedOn: '2026-10-01', ...over,
});
const index = buildIndex([
  make({ id: 'a', title: 'Recursion notes', addedOn: '2026-10-16' }),
  make({ id: 'b', title: 'Recursive thinking slides', type: 'slides', typeLabel: 'Slides', addedOn: '2026-10-15' }),
  make({ id: 'c', title: 'Lab 1 write-up', type: 'lab', typeLabel: 'Lab', description: 'Covers recursion basics', addedOn: '2026-10-14' }),
  make({ id: 'd', title: 'Limits lecture slides', course: 'mat101', courseCode: 'MAT101', courseTitle: 'Calculus I', type: 'slides', typeLabel: 'Slides', semester: 'Spring 2026', addedOn: '2026-10-13' }),
  make({ id: 'e', title: 'Mid-term practice questions', course: 'phy101', courseCode: 'PHY101', courseTitle: 'Physics I', type: 'past-paper', typeLabel: 'Past paper', semester: 'Spring 2026', addedOn: '2026-10-12' }),
]);
const ids = (query) => search(index, query).map((record) => record.id);

test('normalize lowercases and strips accents', () => {
  assert.equal(normalize('Café RÉSUMÉ'), 'cafe resume');
});

test('tokenize splits on punctuation', () => {
  assert.deepEqual(tokenize('Mid-term: Q&A (2026)'), ['mid', 'term', 'q', 'a', '2026']);
});

test('tokenize can split letters from digits for course codes', () => {
  assert.deepEqual(tokenize('CSE101'), ['cse101']);
  assert.deepEqual(tokenize('CSE101', { split: true }), ['cse101', 'cse', '101']);
});

test('Bengali words stay in one piece', () => {
  assert.equal(tokenize('ক্যালকুলাস নোট').length, 2);
});

test('an exact word ranks above a word that only starts the same way', () => {
  assert.deepEqual(ids({ q: 'recursion' }), ['a', 'c']);
  assert.deepEqual(ids({ q: 'recurs' }), ['a', 'b', 'c']);
});

test('every word must match', () => {
  assert.deepEqual(ids({ q: 'recursion lab' }), ['c']);
});

test('course codes work with or without a space', () => {
  assert.deepEqual(ids({ q: 'mat101' }), ['d']);
  assert.deepEqual(ids({ q: 'mat 101' }), ['d']);
});

test('type names are searchable', () => {
  assert.deepEqual(ids({ q: 'past paper' }), ['e']);
});

test('search ignores case and accents', () => {
  assert.deepEqual(ids({ q: 'RÉCURSION' }), ['a', 'c']);
});

test('filters narrow the results', () => {
  assert.deepEqual(ids({ course: 'cse101' }), ['a', 'b', 'c']);
  assert.deepEqual(ids({ type: 'slides' }), ['b', 'd']);
  assert.deepEqual(ids({ semester: 'Spring 2026' }), ['d', 'e']);
  assert.deepEqual(ids({ q: 'slides', course: 'mat101' }), ['d']);
});

test('no words and no filters returns everything, newest first', () => {
  assert.deepEqual(ids({}), ['a', 'b', 'c', 'd', 'e']);
});

test('no match returns an empty list', () => {
  assert.deepEqual(ids({ q: 'zzzz' }), []);
});
