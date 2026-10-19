import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initSearch } from '../src/scripts/search-ui.js';

const HTML = `<!doctype html><html><body>
<form id="search-form" data-index-url="/lib/search-index.json" data-material-base="/lib/materials/" data-submit-url="/lib/submit/" data-courses-url="/lib/courses/">
  <input name="q" type="search">
  <select name="course"><option value="">All courses</option><option value="cse101">CSE101</option><option value="mat101">MAT101</option></select>
  <select name="type"><option value="">All types</option><option value="notes">Notes</option><option value="slides">Slides</option></select>
  <select name="semester"><option value="">All semesters</option><option value="Fall 2026">Fall 2026</option></select>
</form>
<p id="search-status"></p><ul id="search-results"></ul><button id="search-more" type="button" hidden>Show more</button>
</body></html>`;

const rec = (id, over = {}) => ({
  id, title: `Title ${id}`, course: 'cse101', courseCode: 'CSE101', courseTitle: 'Programming', type: 'notes',
  typeLabel: 'Notes', semester: 'Fall 2026', description: '', addedOn: '2026-10-01', ...over,
});
const SMALL = [
  rec('a', { title: 'Recursion notes', addedOn: '2026-10-03' }),
  rec('b', { title: 'Limits slides', course: 'mat101', courseCode: 'MAT101', courseTitle: 'Calculus', type: 'slides', typeLabel: 'Slides', addedOn: '2026-10-02' }),
  rec('c', { title: 'Lab write-up', addedOn: '2026-10-01' }),
];

async function setup({ search = '', records = SMALL } = {}) {
  const dom = new JSDOM(HTML, { url: `https://example.test/lib/search/${search}` });
  const { window } = dom;
  const state = { fail: false, urls: [] };
  const pending = [];
  const api = await initSearch({
    document: window.document,
    location: window.location,
    history: window.history,
    fetchFn: async (url) => {
      state.urls.push(url);
      if (state.fail) throw new Error('offline');
      return { ok: true, json: async () => ({ records }) };
    },
    schedule: (fn) => pending.push(fn),
  });
  const doc = window.document;
  return {
    api, state, window, doc,
    flush: () => Promise.all(pending.splice(0).map((fn) => fn())),
    titles: () => [...doc.querySelectorAll('#search-results h3')].map((node) => node.textContent),
    status: () => doc.getElementById('search-status').textContent,
    field: (name) => doc.querySelector(`[name="${name}"]`),
    more: () => doc.getElementById('search-more'),
  };
}

test('shows the newest materials when nothing is typed', async () => {
  const page = await setup();
  assert.deepEqual(page.titles(), ['Recursion notes', 'Limits slides', 'Lab write-up']);
  assert.match(page.status(), /Showing the newest 3 of 3 materials/);
  assert.deepEqual(page.state.urls, ['/lib/search-index.json']);
});

test('restores a search from the address and links to material pages', async () => {
  const page = await setup({ search: '?q=recursion&course=cse101' });
  assert.equal(page.field('q').value, 'recursion');
  assert.equal(page.field('course').value, 'cse101');
  assert.deepEqual(page.titles(), ['Recursion notes']);
  assert.equal(page.doc.querySelector('#search-results a').getAttribute('href'), '/lib/materials/a/');
});

test('typing updates the results and the address bar', async () => {
  const page = await setup();
  page.field('q').value = 'slides';
  page.field('q').dispatchEvent(new page.window.Event('input', { bubbles: true }));
  await page.flush();
  assert.deepEqual(page.titles(), ['Limits slides']);
  assert.equal(page.window.location.search, '?q=slides');
});

test('only the latest keystroke triggers a search', async () => {
  const page = await setup();
  const q = page.field('q');
  for (const text of ['r', 're', 'rec']) {
    q.value = text;
    q.dispatchEvent(new page.window.Event('input', { bubbles: true }));
  }
  await page.flush();
  assert.equal(page.window.location.search, '?q=rec');
});

test('changing a filter updates the results', async () => {
  const page = await setup();
  page.field('type').value = 'slides';
  page.field('type').dispatchEvent(new page.window.Event('change', { bubbles: true }));
  await page.flush();
  assert.deepEqual(page.titles(), ['Limits slides']);
  assert.equal(page.window.location.search, '?type=slides');
});

test('ignores filter values in the address that do not exist', async () => {
  const page = await setup({ search: '?course=nonexistent' });
  assert.equal(page.field('course').value, '');
  assert.equal(page.titles().length, 3);
});

test('shows 20 at a time with a show more button', async () => {
  const many = Array.from({ length: 45 }, (_, i) => rec(`m${String(i).padStart(2, '0')}`, { addedOn: `2026-09-${String(30 - (i % 28)).padStart(2, '0')}` }));
  const page = await setup({ records: many });
  assert.equal(page.titles().length, 20);
  assert.equal(page.more().hidden, false);
  page.more().click();
  assert.equal(page.titles().length, 40);
  page.more().click();
  assert.equal(page.titles().length, 45);
  assert.equal(page.more().hidden, true);
});

test('explains when nothing matches and links to sharing', async () => {
  const page = await setup({ search: '?q=zzzz' });
  assert.equal(page.titles().length, 0);
  assert.match(page.status(), /No results/);
  assert.equal(page.doc.querySelector('#search-status a').getAttribute('href'), '/lib/submit/');
});

test('reports a loading problem, then recovers on retry', async () => {
  const dom = new JSDOM(HTML, { url: 'https://example.test/lib/search/' });
  const { window } = dom;
  let offline = true;
  const api = await initSearch({
    document: window.document, location: window.location, history: window.history,
    fetchFn: async () => {
      if (offline) throw new Error('offline');
      return { ok: true, json: async () => ({ records: SMALL }) };
    },
    schedule: () => {},
  });
  const status = window.document.getElementById('search-status');
  assert.match(status.textContent, /could not load/);
  assert.equal(status.querySelector('a').getAttribute('href'), '/lib/courses/');
  offline = false;
  await api.run();
  assert.equal(window.document.querySelectorAll('#search-results h3').length, 3);
});

test('does nothing on a page without the search form', async () => {
  const { window } = new JSDOM('<p>hello</p>', { url: 'https://example.test/' });
  const result = await initSearch({ document: window.document, location: window.location, history: window.history });
  assert.equal(result, null);
});
