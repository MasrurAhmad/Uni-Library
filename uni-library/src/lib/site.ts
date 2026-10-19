// Shared site settings and helpers.
export const SITE_NAME = 'SIMT Library';
export const TAGLINE = 'A free, shared library of university study materials.';

// Prefix every internal link with the site's base path (needed on GitHub Pages project sites).
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string): string => `${BASE}${path.startsWith('/') ? path : `/${path}`}`;

// Set automatically by the GitHub Actions workflow; empty when running locally.
export const REPO_URL: string = process.env.REPO_URL ?? '';

// Link to one of the issue forms in .github/ISSUE_TEMPLATE (empty until the repo is connected).
export const issueUrl = (template: string, title = ''): string =>
  REPO_URL
    ? `${REPO_URL}/issues/new?template=${template}${title ? `&title=${encodeURIComponent(title)}` : ''}`
    : '';
