import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from '../scripts/lib/catalog-rules.mjs';
import { FORM_LABELS } from '../scripts/lib/issue-to-entry.mjs';

const script = fileURLToPath(new URL('../scripts/add-from-issue.mjs', import.meta.url));
const courses = [{ slug: 'cse101', code: 'CSE101', title: 'Introduction to Programming', department: 'Computer Science' }];
const materials = [
  { id: 'cse101-existing', title: 'Existing notes', course: 'cse101', type: 'notes', semester: 'Fall 2026', url: 'https://example.com/existing', license: 'own-work', addedOn: '2026-10-01' },
];

const issueText = (changes = {}) =>
  Object.entries({
    [FORM_LABELS.title]: 'Week 3 notes',
    [FORM_LABELS.course]: 'CSE101',
    [FORM_LABELS.type]: 'Notes',
    [FORM_LABELS.semester]: 'Fall 2026',
    [FORM_LABELS.url]: 'https://drive.example.com/file/abc',
    [FORM_LABELS.license]: 'It is my own work',
    [FORM_LABELS.description]: '_No response_',
    [FORM_LABELS.credit]: '_No response_',
    [FORM_LABELS.confirmation]: '- [x] I have the right to share this material and I have read the content policy.',
    ...changes,
  })
    .map(([label, answer]) => `### ${label}\n\n${answer}`)
    .join('\n\n');

// A throwaway copy of the data, so the real catalog is never touched.
function workspace(body, { pullRequest = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'uni-library-test-'));
  writeFileSync(path.join(dir, 'courses.json'), JSON.stringify(courses));
  writeFileSync(path.join(dir, 'materials.json'), JSON.stringify(materials));
  writeFileSync(path.join(dir, 'event.json'), JSON.stringify({ issue: { number: 7, body, ...(pullRequest ? { pull_request: {} } : {}) } }));
  return dir;
}

function run(dir, extraArgs = []) {
  const outputFile = path.join(dir, 'github-output.txt');
  writeFileSync(outputFile, '');
  let exitCode = 0;
  try {
    execFileSync(
      process.execPath,
      [script, '--event', path.join(dir, 'event.json'), '--data-dir', dir, '--comment-file', path.join(dir, 'comment.md'), '--today', '2026-10-17', ...extraArgs],
      { env: { ...process.env, GITHUB_OUTPUT: outputFile, GITHUB_REPOSITORY: 'Demo/uni-library' }, stdio: 'pipe' },
    );
  } catch (error) {
    exitCode = error.status;
  }
  const outputs = Object.fromEntries(
    readFileSync(outputFile, 'utf8').split('\n').filter(Boolean).map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
  const commentFile = path.join(dir, 'comment.md');
  return {
    exitCode,
    outputs,
    materials: JSON.parse(readFileSync(path.join(dir, 'materials.json'), 'utf8')),
    comment: existsSync(commentFile) ? readFileSync(commentFile, 'utf8') : '',
  };
}

test('adds the entry, writes the reply and reports the result', () => {
  const result = run(workspace(issueText()), ['--soft']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.outputs.status, 'ok');
  assert.equal(result.outputs.id, 'cse101-week-3-notes');
  assert.equal(result.materials.length, 2);
  assert.equal(result.materials.at(-1).addedOn, '2026-10-17');
  assert.deepEqual(validateCatalog(courses, result.materials), []);
  assert.ok(result.comment.includes('https://demo.github.io/uni-library/materials/cse101-week-3-notes/'));
});

test('with --soft, a submission with problems is explained and nothing is saved', () => {
  const result = run(workspace(issueText({ [FORM_LABELS.course]: 'ZZZ999' })), ['--soft']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.outputs.status, 'problems');
  assert.equal(result.materials.length, 1);
  assert.match(result.comment, /could not be added/);
});

test('without --soft, problems give a failing exit code', () => {
  assert.equal(run(workspace(issueText({ [FORM_LABELS.course]: 'ZZZ999' }))).exitCode, 1);
});

test('--dry-run shows the entry but saves nothing', () => {
  const result = run(workspace(issueText()), ['--dry-run']);
  assert.equal(result.outputs.status, 'ok');
  assert.equal(result.materials.length, 1);
});

test('pull requests are skipped', () => {
  const result = run(workspace(issueText(), { pullRequest: true }));
  assert.equal(result.outputs.status, 'skipped');
  assert.equal(result.materials.length, 1);
});
