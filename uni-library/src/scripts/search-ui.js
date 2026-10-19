// Search page behavior: loads the index once, searches as you type, keeps the address bar in sync.
import { buildIndex, search } from '../lib/search-core.js';

const PAGE_SIZE = 20;
const FILTERS = ['course', 'type', 'semester'];
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Everything the page needs is passed in, so tests can run this with a fake page and a fake network.
export async function initSearch({
  document: doc = document,
  location: loc = window.location,
  history: hist = window.history,
  fetchFn = (...args) => fetch(...args),
  schedule = (fn, ms) => setTimeout(fn, ms),
  debounceMs = 150,
} = {}) {
  const form = doc.getElementById('search-form');
  if (!form) return null;

  const { indexUrl, materialBase, submitUrl, coursesUrl } = form.dataset;
  const inputs = {
    q: form.elements.namedItem('q'),
    course: form.elements.namedItem('course'),
    type: form.elements.namedItem('type'),
    semester: form.elements.namedItem('semester'),
  };
  const status = doc.getElementById('search-status');
  const list = doc.getElementById('search-results');
  const moreButton = doc.getElementById('search-more');

  let index = null;
  let indexPromise = null;
  let results = [];
  let visible = PAGE_SIZE;
  let latestRun = 0;
  let latestInput = 0;

  const readQuery = () => ({
    q: inputs.q.value.trim(),
    course: inputs.course.value,
    type: inputs.type.value,
    semester: inputs.semester.value,
  });

  function restoreFromUrl() {
    const params = new URLSearchParams(loc.search);
    inputs.q.value = params.get('q') ?? '';
    for (const name of FILTERS) {
      const wanted = params.get(name);
      const known = wanted && [...inputs[name].options].some((option) => option.value === wanted);
      if (known) inputs[name].value = wanted;
    }
  }

  // replaceState (not pushState) so the Back button is not filled with every keystroke.
  function syncUrl(query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    const text = params.toString();
    hist.replaceState(null, '', text ? `${loc.pathname}?${text}` : loc.pathname);
  }

  function setStatus(text, link) {
    status.replaceChildren(text);
    if (link) {
      const anchor = doc.createElement('a');
      anchor.href = link.href;
      anchor.textContent = link.text;
      status.append(' ', anchor);
    }
  }

  function card(record) {
    const item = doc.createElement('li');
    item.className = 'card';
    const heading = doc.createElement('h3');
    const anchor = doc.createElement('a');
    anchor.href = `${materialBase}${record.id}/`;
    anchor.textContent = record.title;
    heading.append(anchor);
    const meta = doc.createElement('p');
    meta.className = 'meta';
    const tag = doc.createElement('span');
    tag.className = 'tag';
    tag.textContent = record.typeLabel || record.type;
    meta.append(tag, ` ${record.courseCode} · ${record.semester}`);
    item.append(heading, meta);
    return item;
  }

  function render(query) {
    const total = results.length;
    list.replaceChildren(...results.slice(0, visible).map(card));
    moreButton.hidden = visible >= total;
    const searching = Boolean(query.q || query.course || query.type || query.semester);
    if (total === 0) {
      setStatus('No results. Try fewer or different words, or clear a filter. Can’t find it?', {
        href: submitUrl,
        text: 'Share it with the library',
      });
    } else if (!searching) {
      setStatus(`Showing the newest ${Math.min(visible, total)} of ${plural(total, 'material')}. Type above to search.`);
    } else {
      setStatus(`${plural(total, 'result')}${total > visible ? `, showing the first ${visible}` : ''}.`);
    }
  }

  function loadIndex() {
    if (index) return Promise.resolve(index);
    indexPromise ??= fetchFn(indexUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`The search index request failed (${response.status}).`);
        return response.json();
      })
      .then((data) => (index = buildIndex(data.records)));
    return indexPromise;
  }

  async function run({ resetPage = true } = {}) {
    const thisRun = ++latestRun;
    if (resetPage) visible = PAGE_SIZE;
    const query = readQuery();
    syncUrl(query);
    if (!index) setStatus('Loading the library…');
    try {
      await loadIndex();
    } catch {
      indexPromise = null; // allow a retry on the next search
      if (thisRun === latestRun) {
        list.replaceChildren();
        moreButton.hidden = true;
        setStatus('Search could not load. Check your connection and try again, or', {
          href: coursesUrl,
          text: 'browse the courses',
        });
      }
      return;
    }
    if (thisRun !== latestRun) return; // a newer search has started, so drop this one
    results = search(index, query);
    render(query);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    return run();
  });
  inputs.q.addEventListener('input', () => {
    const token = ++latestInput;
    schedule(() => (token === latestInput ? run() : undefined), debounceMs);
  });
  for (const name of FILTERS) inputs[name].addEventListener('change', () => run());
  moreButton.addEventListener('click', () => {
    visible += PAGE_SIZE;
    render(readQuery());
  });

  restoreFromUrl();
  await run();
  return { run };
}
