// Visits the link of every material and reports the broken ones.
//   By hand:           npm run check-links         (needs the internet; a big catalog takes a while)
//   In GitHub Actions: the "Check links" workflow runs it every Monday and manages the report issue.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildReport, checkAll, entriesToCheck, summarize } from './lib/link-check.mjs';

const { values: options } = parseArgs({
  options: {
    'data-dir': { type: 'string', default: 'src/data' },
    'report-file': { type: 'string' }, // where to write the report text
    'retry-delay-ms': { type: 'string', default: '5000' },
    limit: { type: 'string' }, // check only the first N entries, to try it out
  },
});

const setOutput = (name, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};

const materials = JSON.parse(readFileSync(path.join(path.resolve(options['data-dir']), 'materials.json'), 'utf8'));
let entries = entriesToCheck(materials);
if (options.limit) entries = entries.slice(0, Number(options.limit));
console.log(`Checking ${entries.length} links (sample entries are skipped)...`);

const results = await checkAll(entries, { retryDelayMs: Number(options['retry-delay-ms']) });
const summary = summarize(entries, results);

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const siteUrl = owner ? `https://${owner.toLowerCase()}.github.io${repo.endsWith('.github.io') ? '' : `/${repo}`}` : '';
const report = buildReport(summary, { siteUrl, date: new Date().toISOString().slice(0, 10) });

console.log(report);
if (options['report-file']) writeFileSync(options['report-file'], report);
setOutput('status', summary.flagged > 0 ? 'problems' : 'ok');
setOutput('flagged', summary.flagged);
setOutput('checked', summary.total);
