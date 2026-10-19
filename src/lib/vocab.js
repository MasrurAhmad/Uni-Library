// Words shared by the site, the catalog checker and the submission helper. Change them here, in one place.

// Material types: the short name stored in materials.json, and the label people see.
export const TYPES = {
  notes: 'Notes',
  slides: 'Slides',
  lab: 'Lab',
  'past-paper': 'Past paper',
  assignment: 'Assignment',
  book: 'Book or open textbook',
  project: 'Project',
  other: 'Other',
};

// Why a material may be shared. `label` is shown on the site; `form` is the matching answer in the submission form.
export const LICENSES = {
  'own-work': { label: 'The contributor’s own work', form: 'It is my own work' },
  'instructor-permitted': { label: 'Shared with the instructor’s permission', form: 'The instructor allows sharing it' },
  'open-license': { label: 'Openly licensed', form: 'It has an open license, such as Creative Commons' },
  'university-permitted': { label: 'Shared with the university’s permission', form: 'The university permits sharing it' },
};

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEMESTER_PATTERN = /^(Spring|Summer|Fall|Winter) \d{4}$/;
