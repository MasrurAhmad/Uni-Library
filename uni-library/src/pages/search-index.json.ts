// Builds /search-index.json at build time: one small record per material. The search page loads it once.
import { courseBySlug, materials, TYPE_LABELS } from '../lib/catalog';

export function GET() {
  const records = materials.map((material) => {
    const course = courseBySlug(material.course);
    return {
      id: material.id,
      title: material.title,
      course: material.course,
      courseCode: course?.code ?? '',
      courseTitle: course?.title ?? '',
      type: material.type,
      typeLabel: TYPE_LABELS[material.type] ?? material.type,
      semester: material.semester,
      description: (material.description ?? '').slice(0, 200),
      addedOn: material.addedOn,
    };
  });
  return new Response(JSON.stringify({ records }), { headers: { 'Content-Type': 'application/json' } });
}
