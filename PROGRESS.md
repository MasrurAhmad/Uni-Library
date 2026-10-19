# Progress checkpoint

Say **resume** to continue from the first unchecked item.

## Decisions so far

- Budget is $0: no card, no custom domain (free github.io address).
- Static-first: Astro site on GitHub Pages. The catalog is JSON in this repository. Files are linked, not hosted.
- No accounts or uploads in version 1. Submissions arrive as GitHub issues.
- Search is a small custom index (`src/lib/search-core.js`) loaded in the browser. Switch to Pagefind when `search-index.json` passes about 1 MB (roughly 3,000 materials) or search feels slow on a cheap phone.
- A moderator approves a submission by adding the `approved` label. A workflow adds the entry, starts the deploy, replies and closes the issue. The helper never opens the link; the moderator does.
- `npm run build` runs the catalog check, the tests, the build and a built-site check. Any failure stops the deploy.
- Every workflow runs on the pinned `ubuntu-24.04` runner. `ubuntu-latest` moves to Ubuntu 26.04 between 19 October and 19 November 2026; test `ubuntu-26.04` on a branch before switching.
- A weekly **Check links** workflow flags broken links, links that ask for a login, and sites that do not respond. Unclear answers (403, 429, 5xx) are counted but not flagged. Sample entries are skipped.
- Uptime is watched from outside GitHub with a free monitor on the home page and on `search-index.json` (steps in `RUNBOOK.md`).

## Steps

- [x] Step 1: scaffold, catalog, validation, policy page, issue forms, CI/CD
- [ ] Step 1b (you): public repo, files pushed, Pages source set to GitHub Actions, Actions permissions allow GitHub's own actions, live address confirmed
- [x] Step 2: browser search with course, type and semester filters, tests, built-site check
- [x] Step 3: moderator helper (issue to catalog entry), shared catalog rules, moderation guide
- [ ] Step 3b (you): upload, run **Create labels** once, submit a test issue, add `approved`, watch it appear
- [x] Step 4: weekly link checker, pinned runner, runbook (built, needs upload)
- [ ] Step 4b (you): upload, run **Check links** once, set up the uptime monitor, turn on two-factor authentication, add a second maintainer
- [ ] Step 5: design brief and the 4D experience
- [ ] Step 6: seed with real, permitted material and invite the first users

## Open items for Masrur

- [ ] Ask a professor or the department what may be shared
- [ ] Choose the project name (the repository name sets the web address)
- [ ] Add a takedown contact to the policy page
