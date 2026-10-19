import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { LICENSES, SLUG_PATTERN, TYPES } from '../src/lib/vocab.js';
import { FORM_LABELS, buildEntry, parseIssueForm, problemsComment, slugify, successComment } from '../scripts/lib/issue-to-entry.mjs';

const courses = [
  { slug: 'cse101', code: 'CSE101', title: 'Introduction to Programming', department: 'Computer Science' },
  { slug: 'mat101', code: 'MAT101', title: 'Calculus I', department: 'Mathematics' },
];
const materials = [
  { id: 'cse101-existing', title: 'Existing notes', course: 'cse101', type: 'notes', semester: 'Fall 2026', url: 'https://example.com/existing', license: 'own-work', addedOn: '2026-10-01' },
];
const TODAY = '2026-10-17';

const ANSWERS = {
  [FORM_LABELS.title]: 'Week 3 lecture notes on recursion',
  [FORM_LABELS.course]: 'cse 101',
  [FORM_LABELS.type]: 'Notes',
  [FORM_LABELS.semester]: 'fall 2026',
  [FORM_LABELS.url]: 'https://drive.example.com/file/abc',
  [FORM_LABELS.license]: 'It is my own work',
  [FORM_LABELS.description]: '_No response_',
  [FORM_LABELS.credit]: '_No response_',
  [FORM_LABELS.confirmation]: '- [x] I confirm this information is accurate.',
};
// Text laid out the way GitHub writes a submitted issue form.
const issue = (changes = {}) =>
  Object.entries({ ...ANSWERS, ...changes })
    .map(([label, answer]) => `### ${label}\n\n${answer}`)
    .join('\n\n');
const build = (changes, extra = {}) => buildEntry({ body: issue(changes), courses, materials, today: TODAY, ...extra });
const said = (result, text) => result.problems.some((problem) => problem.includes(text));

test('parseIssueForm reads each answer under its heading', () => {
  const { fields, problems } = parseIssueForm(issue());
  assert.deepEqual(problems, []);
  assert.equal(fields[FORM_LABELS.title], 'Week 3 lecture notes on recursion');
  assert.equal(fields[FORM_LABELS.type], 'Notes');
});

test('builds an entry from a correct submission', () => {
  const result = build();
  assert.equal(result.ok, true, result.problems.join('; '));
  assert.deepEqual(result.entry, {
    id: 'cse101-week-3-lecture-notes-on-recursion',
    title: 'Week 3 lecture notes on recursion',
    course: 'cse101',
    type: 'notes',
    semester: 'Fall 2026',
    url: 'https://drive.example.com/file/abc',
    license: 'own-work',
    addedOn: TODAY,
  });
});

test('keeps a description and a credit when they are given', () => {
  const result = build({ [FORM_LABELS.description]: 'Covers\n\nbase cases and recursion.', [FORM_LABELS.credit]: 'Rafi' });
  assert.equal(result.entry.description, 'Covers base cases and recursion.');
  assert.equal(result.entry.contributor, 'Rafi');
});

test('finds the course whatever the case or spacing', () => {
  assert.equal(build({ [FORM_LABELS.course]: ' Mat101 ' }).entry.course, 'mat101');
});

test('rejects a course that does not exist and lists the known ones', () => {
  const result = build({ [FORM_LABELS.course]: 'ZZZ999' });
  assert.equal(result.ok, false);
  assert.ok(said(result, 'not in the library'));
  assert.ok(said(result, 'CSE101, MAT101'));
});

test('rejects an unknown type or reason', () => {
  assert.ok(said(build({ [FORM_LABELS.type]: 'Poster' }), 'is not one of'));
  assert.ok(said(build({ [FORM_LABELS.license]: 'Found it online' }), 'not one of the form'));
});

test('rejects a link that is not https', () => {
  assert.ok(said(build({ [FORM_LABELS.url]: 'http://example.com/x' }), 'https://'));
});

test('rejects a link that is already in the library', () => {
  assert.ok(said(build({ [FORM_LABELS.url]: 'https://example.com/existing' }), 'already in the library as `cse101-existing`'));
});

test('requires the confirmation box to be ticked', () => {
  const result = build({ [FORM_LABELS.confirmation]: '- [ ] I have the right to share this material and I have read the content policy.' });
  assert.ok(said(result, 'not ticked'));
});

test('flags a repeated heading, which means the text was edited', () => {
  const result = buildEntry({ body: `${issue()}\n\n### Title\n\nSomething else`, courses, materials, today: TODAY });
  assert.ok(said(result, 'appears twice'));
});

test('a heading inside the description stays part of the description', () => {
  const result = build({ [FORM_LABELS.description]: 'Covers loops.\n\n### Topics\n\nrecursion' });
  assert.equal(result.ok, true, result.problems.join('; '));
  assert.equal(result.entry.description, 'Covers loops. ### Topics recursion');
});

test('a title with no Latin letters still gets a valid id', () => {
  const result = build({ [FORM_LABELS.title]: 'ক্যালকুলাস নোট' });
  assert.equal(result.ok, true, result.problems.join('; '));
  assert.match(result.entry.id, /^cse101-notes-[0-9a-f]{6}$/);
  assert.ok(SLUG_PATTERN.test(result.entry.id));
  assert.equal(result.entry.title, 'ক্যালকুলাস নোট');
});

test('two entries with the same title get different ids', () => {
  const taken = [...materials, { ...materials[0], id: 'cse101-week-3-lecture-notes-on-recursion', url: 'https://example.com/other' }];
  assert.equal(build({}, { materials: taken }).entry.id, 'cse101-week-3-lecture-notes-on-recursion-2');
});

test('rejects an over-long description', () => {
  assert.ok(said(build({ [FORM_LABELS.description]: 'x'.repeat(401) }), 'description must be'));
});

test('reports every empty required answer', () => {
  const result = build({ [FORM_LABELS.title]: '_No response_', [FORM_LABELS.url]: '_No response_', [FORM_LABELS.course]: '_No response_' });
  assert.ok(said(result, 'title is empty'));
  assert.ok(said(result, 'link is empty'));
  assert.ok(said(result, 'course code is empty'));
});

test('slugify turns text into a web-safe word list', () => {
  assert.equal(slugify('  Café: Résumé #1! '), 'cafe-resume-1');
});

test('replies link to the new page and tell moderators what to do', () => {
  const ok = successComment({ entry: { id: 'a-1' }, course: { code: 'CSE101' }, siteUrl: 'https://u.github.io/r' });
  assert.ok(ok.includes('https://u.github.io/r/materials/a-1/'));
  assert.ok(problemsComment(['the title is empty']).includes('**approved**'));
});

test('the submission form and the helper agree', () => {
  const form = parse(readFileSync(new URL('../.github/ISSUE_TEMPLATE/submit-material.yml', import.meta.url), 'utf8'));
  const fields = form.body.filter((item) => item.attributes?.label);
  const labels = fields.map((item) => item.attributes.label);
  for (const label of Object.values(FORM_LABELS)) assert.ok(labels.includes(label), `the form has no field labelled "${label}"`);
  const options = (label) => fields.find((item) => item.attributes.label === label).attributes.options;
  assert.deepEqual([...options(FORM_LABELS.type)].sort(), Object.values(TYPES).sort());
  assert.deepEqual([...options(FORM_LABELS.license)].sort(), Object.values(LICENSES).map((license) => license.form).sort());
  const confirmation = fields.find((item) => item.attributes.label === FORM_LABELS.confirmation);
  assert.ok(confirmation.attributes.options.every((option) => option.required === true));
});
