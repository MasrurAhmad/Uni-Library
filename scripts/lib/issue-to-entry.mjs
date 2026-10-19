// Turns the text of a "Submit a material" issue into a catalog entry.
// Pure functions: no files, no network. The issue text is untrusted, so everything is checked here.
import { createHash } from 'node:crypto';
import { LICENSES, SEMESTER_PATTERN, TYPES } from '../../src/lib/vocab.js';
import { validateCatalog } from './catalog-rules.mjs';

// These must match the label of each field in .github/ISSUE_TEMPLATE/submit-material.yml (a test checks it).
export const FORM_LABELS = {
  title: 'Title',
  course: 'Course code',
  type: 'Type',
  semester: 'Semester',
  url: 'Link to the file',
  license: 'Why may this be shared?',
  description: 'Short description',
  credit: 'Name to show (optional)',
  confirmation: 'Confirmation',
};
const KNOWN_LABELS = new Set(Object.values(FORM_LABELS));
const EMPTY_ANSWER = /^_No response_$/i;

const squash = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const compact = (text) => String(text ?? '').replace(/\s+/g, '').toUpperCase();
const code = (value) => `\`${String(value).replace(/`/g, "'").slice(0, 60)}\``; // code spans stop @mentions from pinging people

export function slugify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sameUrl(a, b) {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
}

/** GitHub writes each form answer under a "### Label" heading. Split the issue text back into answers. */
export function parseIssueForm(body) {
  const text = String(body ?? '').replace(/\r\n/g, '\n');
  const parts = text.split(/^### +(.+?) *$/m); // [text before, heading, answer, heading, answer, ...]
  const fields = {};
  const problems = [];
  let current = null;
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].trim();
    const answer = parts[i + 1].trim();
    if (KNOWN_LABELS.has(heading)) {
      if (heading in fields) problems.push(`the heading “${heading}” appears twice, so the issue text was changed`);
      fields[heading] = answer;
      current = heading;
    } else if (current) {
      fields[current] += `\n### ${heading}\n${answer}`; // a heading inside a long answer belongs to that answer
    }
  }
  return { fields, problems };
}

function makeId(course, title, type, url, taken) {
  const words = slugify(title).slice(0, 60).replace(/-+$/, '');
  // A title with no Latin letters or digits (for example Bengali) gets the type and a short fingerprint of the link.
  const stem = words
    ? `${course.slug}-${words}`
    : `${course.slug}-${type}-${createHash('sha1').update(url).digest('hex').slice(0, 6)}`;
  let id = stem;
  for (let n = 2; taken.has(id); n += 1) id = `${stem}-${n}`;
  return id;
}

/** Build a catalog entry from an issue. Returns { ok, entry, course, problems }. */
export function buildEntry({ body, courses, materials, today }) {
  const { fields, problems } = parseIssueForm(body);
  const get = (key) => {
    const answer = fields[FORM_LABELS[key]];
    return answer === undefined || EMPTY_ANSWER.test(answer) ? '' : answer;
  };
  const say = (message) => problems.push(message);

  const title = squash(get('title'));
  if (!title) say('the title is empty');

  const courseCode = squash(get('course'));
  const course = courses.find((c) => compact(c.code) === compact(courseCode));
  if (!courseCode) say('the course code is empty');
  else if (!course) {
    say(`the course code ${code(courseCode)} is not in the library (known codes: ${courses.map((c) => c.code).join(', ')}). Add the course first, or correct the code`);
  }

  const typeLabel = squash(get('type'));
  const type = Object.keys(TYPES).find((slug) => TYPES[slug].toLowerCase() === typeLabel.toLowerCase());
  if (!type) say(`the type ${code(typeLabel)} is not one of: ${Object.values(TYPES).join(', ')}`);

  const semesterText = squash(get('semester'));
  const semester = semesterText.replace(
    /^(spring|summer|fall|winter) +(\d{4})$/i,
    (_, season, year) => `${season[0].toUpperCase()}${season.slice(1).toLowerCase()} ${year}`,
  );
  if (!SEMESTER_PATTERN.test(semester)) say(`the semester ${code(semesterText)} must look like “Fall 2026”`);

  const url = get('url').trim();
  if (!url) say('the link is empty');
  const sameLink = materials.find((m) => sameUrl(m.url, url));
  if (sameLink) say(`this link is already in the library as ${code(sameLink.id)}`);

  const licenseLabel = squash(get('license'));
  const license = Object.keys(LICENSES).find((slug) => LICENSES[slug].form.toLowerCase() === licenseLabel.toLowerCase());
  if (!license) say(`the reason it may be shared (${code(licenseLabel)}) is not one of the form’s answers`);

  if (!/^- \[[xX]\]/m.test(fields[FORM_LABELS.confirmation] ?? '')) {
    say('the confirmation box (“I have the right to share this material…”) is not ticked');
  }

  const description = squash(get('description'));
  const credit = squash(get('credit'));

  if (problems.length > 0) return { ok: false, problems };

  const entry = {
    id: makeId(course, title, type, url, new Set(materials.map((m) => m.id))),
    title,
    course: course.slug,
    type,
    semester,
    url,
    ...(description ? { description } : {}),
    ...(credit ? { contributor: credit } : {}),
    license,
    addedOn: today,
  };

  // The same rules that guard the whole catalog.
  const broken = validateCatalog(courses, [...materials, entry]).filter((p) => p.id === entry.id);
  if (broken.length > 0) return { ok: false, problems: broken.map((p) => p.message) };
  return { ok: true, entry, course, problems: [] };
}

export function successComment({ entry, course, siteUrl }) {
  const link = siteUrl ? `\n\nIt will be live in a minute or two: ${siteUrl}/materials/${entry.id}/` : '';
  return `Thank you. This submission was added to the library as \`${entry.id}\` (${course.code}).${link}\n`;
}

export function problemsComment(problems) {
  const list = problems.map((problem) => `- ${problem}`).join('\n');
  return `This submission could not be added yet:\n\n${list}\n\nThe submitter or a moderator can edit the issue to fix this. Then add the **approved** label again.\n`;
}
