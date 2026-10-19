// The rules every catalog entry must follow. Used by `npm run validate` and by the submission helper.
import { TYPES, LICENSES, SLUG_PATTERN, SEMESTER_PATTERN } from '../../src/lib/vocab.js';

const TYPE_SLUGS = Object.keys(TYPES);
const LICENSE_SLUGS = Object.keys(LICENSES);
const COURSE_FIELDS = ['slug', 'code', 'title', 'department', 'sample'];
const MATERIAL_FIELDS = ['id', 'title', 'course', 'type', 'semester', 'url', 'description', 'contributor', 'license', 'addedOn', 'sample'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max;

/** Check the catalog. Returns a list of problems ({ where, id, message }). An empty list means all is well. */
export function validateCatalog(courses, materials) {
  const problems = [];
  const report = (where, message, id = null) => problems.push({ where, id, message });

  const courseSlugs = new Set();
  courses.forEach((course, index) => {
    const where = `courses.json entry ${index + 1}`;
    if (typeof course !== 'object' || course === null) return report(where, 'must be an object { ... }');
    for (const key of Object.keys(course)) if (!COURSE_FIELDS.includes(key)) report(where, `unknown field "${key}" (typo?)`);
    if (!SLUG_PATTERN.test(course.slug ?? '')) report(where, 'slug must use lowercase letters, numbers and dashes only');
    if (courseSlugs.has(course.slug)) report(where, `duplicate slug "${course.slug}"`);
    courseSlugs.add(course.slug);
    if (!text(course.code, 2, 12)) report(where, 'code must be 2 to 12 characters');
    if (!text(course.title, 3, 120)) report(where, 'title must be 3 to 120 characters');
    if (!text(course.department, 2, 80)) report(where, 'department must be 2 to 80 characters');
  });

  const materialIds = new Set();
  const usedLinks = new Map();
  materials.forEach((item, index) => {
    const where = `materials.json entry ${index + 1}${item?.id ? ` (${item.id})` : ''}`;
    if (typeof item !== 'object' || item === null) return report(where, 'must be an object { ... }');
    const say = (message) => report(where, message, item.id ?? null);

    for (const key of Object.keys(item)) if (!MATERIAL_FIELDS.includes(key)) say(`unknown field "${key}" (typo?)`);
    if (!SLUG_PATTERN.test(item.id ?? '')) say('id must use lowercase letters, numbers and dashes only');
    if (materialIds.has(item.id)) say(`duplicate id "${item.id}"`);
    materialIds.add(item.id);
    if (!text(item.title, 3, 140)) say('title must be 3 to 140 characters');
    if (!courseSlugs.has(item.course)) say(`course "${item.course}" does not exist in courses.json`);
    if (!TYPE_SLUGS.includes(item.type)) say(`type must be one of: ${TYPE_SLUGS.join(', ')}`);
    if (!SEMESTER_PATTERN.test(item.semester ?? '')) say('semester must look like "Fall 2026"');
    if (!LICENSE_SLUGS.includes(item.license)) say(`license must be one of: ${LICENSE_SLUGS.join(', ')}`);
    if (!DATE.test(item.addedOn ?? '') || Number.isNaN(Date.parse(item.addedOn))) say('addedOn must be a date like 2026-10-16');
    if (item.description !== undefined && !text(item.description, 1, 400)) say('description must be 1 to 400 characters');
    if (item.contributor !== undefined && !text(item.contributor, 1, 60)) say('contributor must be 1 to 60 characters');

    let link = null;
    try { link = new URL(item.url); } catch { say('url is not a valid web address'); }
    if (link) {
      if (link.protocol !== 'https:') say('url must start with https://');
      if (link.username || link.password) say('url must not contain a username or password');
      if (item.url.length > 500) say('url is longer than 500 characters');
      if (usedLinks.has(link.href)) say(`this link is already used by "${usedLinks.get(link.href)}"`);
      usedLinks.set(link.href, item.id);
    }
  });

  return problems;
}

export const formatProblem = (problem) => `  - ${problem.where}: ${problem.message}`;
