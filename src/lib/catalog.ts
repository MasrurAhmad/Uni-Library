// Reads the catalog data and offers small helpers. The data lives in src/data/*.json.
import coursesData from '../data/courses.json';
import materialsData from '../data/materials.json';
import { TYPES, LICENSES } from './vocab.js';

export interface Course {
  slug: string;
  code: string;
  title: string;
  department: string;
  sample?: boolean;
}

export interface Material {
  id: string;
  title: string;
  course: string;
  type: string;
  semester: string;
  url: string;
  description?: string;
  contributor?: string;
  license: string;
  addedOn: string;
  sample?: boolean;
}

export const courses: Course[] = [...(coursesData as Course[])].sort((a, b) => a.code.localeCompare(b.code));

// Newest first, then alphabetical.
export const materials: Material[] = [...(materialsData as Material[])].sort(
  (a, b) => b.addedOn.localeCompare(a.addedOn) || a.title.localeCompare(b.title),
);

export const TYPE_LABELS: Record<string, string> = TYPES;

export const LICENSE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(LICENSES).map(([slug, { label }]) => [slug, label]),
);

export const courseBySlug = (slug: string): Course | undefined => courses.find((c) => c.slug === slug);
export const materialsForCourse = (slug: string): Material[] => materials.filter((m) => m.course === slug);
export const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
export const hasSampleData: boolean = materials.some((m) => m.sample) || courses.some((c) => c.sample);
