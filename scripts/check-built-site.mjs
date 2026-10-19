// Runs after the build. Loads the real, built search page in a fake browser, runs a search against the
// real built index, and checks that every result links to a page that exists.
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { initSearch } from '../src/scripts/search-ui.js';
import { tokenize } from '../src/lib/search-core.js';

const dist = new URL('../dist/', import.meta.url);
const problems = [];
const fail = (message) => problems.push(`  - ${message}`);
const finish = () => {
  console.error(`Built-site check failed:\n${problems.join('\n')}`);
  process.exit(1);
};

const pageFile = new URL('search/index.html', dist);
const indexFile = new URL('search-index.json', dist);
if (!existsSync(pageFile)) fail('dist/search/index.html is missing');
if (!existsSync(indexFile)) fail('dist/search-index.json is missing');
if (problems.length > 0) finish();

const html = readFileSync(pageFile, 'utf8');
const data = JSON.parse(readFileSync(indexFile, 'utf8'));
const records = data.records ?? [];

// The page tells the script where things are. Read those settings from the built page.
const probe = new JSDOM(html).window.document;
const form = probe.getElementById('search-form');
if (!form) fail('the search page has no form with id "search-form"');
for (const name of ['q', 'course', 'type', 'semester']) {
  if (!form?.querySelector(`[name="${name}"]`)) fail(`the search form has no field named "${name}"`);
}
for (const id of ['search-status', 'search-results', 'search-more']) {
  if (!probe.getElementById(id)) fail(`the search page has no element with id "${id}"`);
}
if (problems.length > 0) finish();

const { indexUrl, materialBase } = form.dataset;
if (!indexUrl?.endsWith('/search-index.json')) fail(`unexpected index address: ${indexUrl}`);
if (!materialBase?.endsWith('/materials/')) fail(`unexpected material address: ${materialBase}`);
if (problems.length > 0) finish();

for (const record of records) {
  if (!existsSync(new URL(`materials/${record.id}/index.html`, dist))) fail(`no built page for material "${record.id}"`);
}

if (records.length > 0) {
  const target = records[0];
  const word = tokenize(target.title)[0];
  const base = indexUrl.replace(/\/search-index\.json$/, '');
  const { window } = new JSDOM(html, { url: `https://example.test${base}/search/?q=${encodeURIComponent(word)}` });
  await initSearch({
    document: window.document,
    location: window.location,
    history: window.history,
    fetchFn: async (url) => {
      if (url !== indexUrl) throw new Error(`asked for ${url}, expected ${indexUrl}`);
      return { ok: true, json: async () => data };
    },
    schedule: () => {},
  });
  const links = [...window.document.querySelectorAll('#search-results a')].map((a) => a.getAttribute('href'));
  if (!links.includes(`${materialBase}${target.id}/`)) fail(`searching "${word}" did not find "${target.title}"`);
}

if (problems.length > 0) finish();
console.log(`Built-site check OK: ${records.length} materials indexed, search page wired correctly.`);
