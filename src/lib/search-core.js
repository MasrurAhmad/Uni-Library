// Search logic with no browser or Astro code in it, so it can be tested with plain Node.

/** Lowercase the text and strip accents from Latin letters ("Café" becomes "cafe"). */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase();
}

/**
 * Split text into searchable words. Letters, digits and combining marks (used by scripts such as
 * Bengali) all count as part of a word. With split: true, a word like "cse101" also yields "cse"
 * and "101", so people can search for "cse 101".
 */
export function tokenize(text, { split = false } = {}) {
  const words = normalize(text).match(/[\p{L}\p{N}\p{M}]+/gu) ?? [];
  if (!split) return words;
  const tokens = [];
  for (const word of words) {
    tokens.push(word);
    const parts = /^(\p{L}+)(\p{N}+)$/u.exec(word);
    if (parts) tokens.push(parts[1], parts[2]);
  }
  return tokens;
}

// How much a match in each field is worth. A title match matters most.
const FIELD_WEIGHTS = { title: 10, code: 8, course: 4, meta: 3, description: 2 };
const PREFIX_FACTOR = 0.6; // a word that only starts with your term scores lower than an exact word
const ALL_IN_TITLE_BONUS = 5;

/** Prepare the records from search-index.json for fast searching. */
export function buildIndex(records) {
  return records.map((record) => ({
    record,
    fields: {
      title: tokenize(record.title, { split: true }),
      code: tokenize(record.courseCode, { split: true }),
      course: tokenize(record.courseTitle),
      meta: tokenize(`${record.typeLabel ?? ''} ${record.type} ${record.semester}`),
      description: tokenize(record.description ?? ''),
    },
  }));
}

function scoreTerm(tokens, term, weight) {
  let best = 0;
  for (const token of tokens) {
    if (token === term) return weight;
    if (token.startsWith(term)) best = weight * PREFIX_FACTOR;
  }
  return best;
}

/**
 * Find records. Every word you type must match somewhere (words may be unfinished: "recurs" finds
 * "recursion"). Filters are exact. With no words, everything that passes the filters is returned,
 * newest first. Returns the matching records, best match first.
 */
export function search(index, { q = '', course = '', type = '', semester = '' } = {}) {
  const terms = tokenize(q);
  const found = [];

  for (const { record, fields } of index) {
    if (course && record.course !== course) continue;
    if (type && record.type !== type) continue;
    if (semester && record.semester !== semester) continue;

    let score = 0;
    let everyTermMatches = true;
    let everyTermInTitle = true;
    for (const term of terms) {
      let best = 0;
      for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
        best = Math.max(best, scoreTerm(fields[field], term, weight));
      }
      if (best === 0) {
        everyTermMatches = false;
        break;
      }
      score += best;
      if (scoreTerm(fields.title, term, 1) === 0) everyTermInTitle = false;
    }
    if (!everyTermMatches) continue;
    if (terms.length > 0 && everyTermInTitle) score += ALL_IN_TITLE_BONUS;
    found.push({ record, score });
  }

  found.sort(
    (a, b) =>
      b.score - a.score ||
      b.record.addedOn.localeCompare(a.record.addedOn) ||
      a.record.title.localeCompare(b.record.title),
  );
  return found.map((item) => item.record);
}
