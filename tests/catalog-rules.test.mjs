import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog } from '../scripts/lib/catalog-rules.mjs';

const courses = [{ slug: 'cse101', code: 'CSE101', title: 'Introduction to Programming', department: 'Computer Science' }];
const good = {
  id: 'cse101-notes', title: 'Recursion notes', course: 'cse101', type: 'notes', semester: 'Fall 2026',
  url: 'https://example.com/a', license: 'own-work', addedOn: '2026-10-16',
};
const other = (change) => ({ ...good, id: 'cse101-other', url: 'https://example.com/b', ...change });
const messages = (item) => validateCatalog(courses, [good, item]).map((problem) => problem.message);
const mentions = (list, text) => list.some((message) => message.includes(text));

test('a correct catalog has no problems', () => {
  assert.deepEqual(validateCatalog(courses, [good, other({})]), []);
});
test('rejects an unknown course', () => assert.ok(mentions(messages(other({ course: 'nope' })), 'does not exist')));
test('rejects an unknown type', () => assert.ok(mentions(messages(other({ type: 'poster' })), 'type must be one of')));
test('rejects an unknown license', () => assert.ok(mentions(messages(other({ license: 'free-for-all' })), 'license must be one of')));
test('requires https links', () => assert.ok(mentions(messages(other({ url: 'http://example.com/b' })), 'https://')));
test('rejects passwords inside links', () => {
  assert.ok(mentions(messages(other({ url: 'https://user:secret@example.com/b' })), 'username or password'));
});
test('rejects text that is not a link', () => assert.ok(mentions(messages(other({ url: 'not a link' })), 'not a valid web address')));
test('rejects duplicate ids', () => assert.ok(mentions(messages(other({ id: good.id })), 'duplicate id')));
test('rejects a link that is already listed', () => assert.ok(mentions(messages(other({ url: good.url })), 'already used')));
test('rejects a badly written semester', () => assert.ok(mentions(messages(other({ semester: 'Autumn 2026' })), 'semester must look like')));
test('rejects an impossible date', () => assert.ok(mentions(messages(other({ addedOn: '2026-13-45' })), 'addedOn')));
test('rejects unknown fields, which are usually typos', () => assert.ok(mentions(messages(other({ titel: 'x' })), 'unknown field')));
test('rejects a too short title', () => assert.ok(mentions(messages(other({ title: 'ab' })), 'title must be')));
test('rejects entries that are not objects', () => {
  assert.ok(mentions(validateCatalog(courses, [good, 'text']).map((problem) => problem.message), 'must be an object'));
});
test('checks courses too', () => {
  const problems = validateCatalog([{ slug: 'Bad Slug', code: 'X', title: 'ab', department: 'D' }], []);
  assert.ok(problems.length >= 4);
});
