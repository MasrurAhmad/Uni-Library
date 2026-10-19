// @ts-check
import { defineConfig } from 'astro/config';

// On GitHub Actions these are set automatically (see .github/workflows/deploy.yml).
// Locally they fall back to a plain dev server at the root path.
const site = process.env.SITE || 'http://localhost:4321';
let base = process.env.BASE || '/';
// A repository named <owner>.github.io is served from the domain root, not a sub-path.
if (base.replace(/^\//, '').endsWith('.github.io')) base = '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
});
