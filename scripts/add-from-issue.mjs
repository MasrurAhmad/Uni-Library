// Turns an approved submission issue into a catalog entry.
//   In GitHub Actions:  node scripts/add-from-issue.mjs --event "$GITHUB_EVENT_PATH" --soft --comment-file comment.md
//   By hand, to try it: npm run add -- --body issue.txt --dry-run
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildEntry, problemsComment, successComment } from './lib/issue-to-entry.mjs';

const { values: options } = parseArgs({
  options: {
    event: { type: 'string' }, // the GitHub event file (used by the workflow)
    body: { type: 'string' }, // a text file holding the issue text (for trying it by hand)
    'data-dir': { type: 'string', default: 'src/data' },
    'comment-file': { type: 'string' }, // where to write the reply for the issue
    today: { type: 'string' },
    'dry-run': { type: 'boolean', default: false }, // show the entry without saving it
    soft: { type: 'boolean', default: false }, // exit 0 even when the submission has problems
  },
});

const setOutput = (name, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};
const finish = (status, exitCode = 0) => {
  setOutput('status', status);
  process.exit(exitCode);
};
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

let body;
if (options.event) {
  const event = readJson(options.event);
  if (event.issue?.pull_request) {
    console.log('This is a pull request, not a submission. Nothing to do.');
    finish('skipped');
  }
  body = event.issue?.body ?? '';
} else if (options.body) {
  body = readFileSync(options.body, 'utf8');
} else {
  console.error('Usage: npm run add -- --body issue.txt [--dry-run]');
  process.exit(1);
}

const dir = path.resolve(options['data-dir']);
const courses = readJson(path.join(dir, 'courses.json'));
const materialsFile = path.join(dir, 'materials.json');
const materials = readJson(materialsFile);
const today = options.today ?? new Date().toISOString().slice(0, 10);

const result = buildEntry({ body, courses, materials, today });

// Where the site lives, so the reply can link to the new page.
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const siteUrl = owner ? `https://${owner.toLowerCase()}.github.io${repo.endsWith('.github.io') ? '' : `/${repo}`}` : '';

if (!result.ok) {
  console.error(`Not added. Problems:\n${result.problems.map((problem) => `  - ${problem}`).join('\n')}`);
  if (options['comment-file']) writeFileSync(options['comment-file'], problemsComment(result.problems));
  finish('problems', options.soft ? 0 : 1);
}

console.log(`${options['dry-run'] ? 'Would add' : 'Added'}:\n${JSON.stringify(result.entry, null, 2)}`);
if (!options['dry-run']) writeFileSync(materialsFile, `${JSON.stringify([...materials, result.entry], null, 2)}\n`);
if (options['comment-file']) {
  writeFileSync(options['comment-file'], successComment({ entry: result.entry, course: result.course, siteUrl }));
}
setOutput('id', result.entry.id);
finish('ok');
