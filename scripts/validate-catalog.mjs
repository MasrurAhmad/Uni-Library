// Checks the catalog data before every build. Run it yourself with: npm run validate
import { readFileSync } from 'node:fs';
import { formatProblem, validateCatalog } from './lib/catalog-rules.mjs';

const load = (relativePath) => JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

let courses;
let materials;
try {
  courses = load('../src/data/courses.json');
  materials = load('../src/data/materials.json');
} catch (error) {
  console.error(`Catalog problem: cannot read the data files.\n  ${error.message}`);
  process.exit(1);
}
if (!Array.isArray(courses) || !Array.isArray(materials)) {
  console.error('Catalog problem: courses.json and materials.json must each hold a list, like [ ... ].');
  process.exit(1);
}

const problems = validateCatalog(courses, materials);
if (problems.length > 0) {
  console.error(`Catalog check failed with ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${problems.map(formatProblem).join('\n')}`);
  process.exit(1);
}
console.log(`Catalog OK: ${courses.length} courses, ${materials.length} materials.`);
