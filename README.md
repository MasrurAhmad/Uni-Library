# Uni Library

A free, shared library of university study materials. It costs nothing to run: a static website on GitHub Pages, with the catalog stored as data files in this repository.

- **No server, no database, no card.** Nothing to crash, pause, or bill you.
- **Files are linked, not hosted.** Each entry points to a file kept by whoever shared it.
- **Moderated.** Submissions arrive as GitHub issues. A moderator approves a good one with a single label, and a helper adds it to the catalog.

Built with [Astro](https://astro.build) (static output). Steps 1 to 4 are built: a plain, fast baseline with search in the browser, a helper that turns approved submissions into catalog entries, and a weekly link check with a runbook for when things break. The "4D" design comes in a later step (see `PROGRESS.md`).

## Run it on your computer

You need Node.js 22.22 or newer.

```sh
npm install
npm run dev        # opens http://localhost:4321
```

Other commands: `npm run validate` (check the catalog), `npm test` (run the tests), `npm run build` (check the catalog, run the tests, make the site in `dist/`, then check the built search page), `npm run preview` (view the built site), `npm run check-links` (visit every link and list the broken ones). If any check fails, the build stops and nothing goes live.

## Put it online for free (GitHub Pages)

1. Create a free GitHub account if you do not have one.
2. Create a new **public** repository. Its name becomes part of the web address: `https://YOUR-NAME.github.io/REPO-NAME/`.
3. Add these files to the repository (see "Upload the files" below).
4. In the repository go to **Settings > Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Open the **Actions** tab. The workflow "Check, build and deploy" runs on every push to `main`. When it turns green, your site is live at the address above. If it ran before you changed the Pages setting, open it and press **Re-run all jobs**.

### Upload the files

With Git installed:

```sh
git init
git add .
git commit -m "Step 1: scaffold"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/REPO-NAME.git
git push -u origin main
```

Without Git: on the repository page choose **Add file > Upload files** and drag in the contents of this folder (not the folder itself). Make sure the hidden `.github` folder is included; if it is not, the site will not deploy. You can instead create `.github/workflows/deploy.yml` with **Add file > Create new file** and paste its contents.

## Add a material

1. Open `src/data/materials.json` and copy an existing entry.
2. Change every field. Use only links that open without logging in, and only material that follows the content policy (`src/pages/policy.md`).
3. Run `npm run validate`. It tells you exactly what is wrong, if anything.
4. Commit. The site updates by itself in a minute or two.

Courses live in `src/data/courses.json`. The sample entries (`"sample": true`) show a banner on every page. Delete them, and the banner disappears, once real material is in.

## Moderating submissions

People submit through the form on the site, which opens a GitHub issue. A moderator checks the link and adds the **approved** label. A workflow (`.github/workflows/add-approved.yml`) then adds the entry to `src/data/materials.json`, starts the deploy, replies on the issue and closes it. If something is wrong, it explains and removes the label.

Read `MODERATION.md` for the checklist and the one-time setup (run the **Create labels** workflow once).

## Keeping it healthy

- Every Monday the **Check links** workflow visits every material's link. If some are broken, it opens one issue labelled `link-check`. When all links are fine, it closes that issue.
- Set up a free uptime monitor once (steps in `RUNBOOK.md`). It emails you if the site stops answering.
- `RUNBOOK.md` also covers what to do when an alert arrives, how to roll back a bad change, backups, account safety and exam weeks.
- Every workflow runs on a pinned runner (`ubuntu-24.04`), so a change in GitHub's default image cannot surprise you.

## Folder map

| Path | What it is |
| --- | --- |
| `src/data/` | The catalog: courses and materials |
| `src/pages/` | One file per page |
| `src/layouts/`, `src/components/` | Shared page frame and small building blocks |
| `src/styles/global.css` | All styling |
| `scripts/validate-catalog.mjs` | Catalog checker, runs before every build |
| `scripts/check-built-site.mjs` | Loads the built search page and runs a search, runs after every build |
| `src/lib/search-core.js` | The search logic (no browser code, so it is easy to test) |
| `src/scripts/` | The search page behavior in the browser |
| `src/pages/search-index.json.ts` | Builds the search index file |
| `tests/` | Automated tests for the search, the catalog rules and the submission helper |
| `src/lib/vocab.js` | The shared list of material types and sharing reasons |
| `scripts/add-from-issue.mjs`, `scripts/lib/` | The submission helper and the catalog rules |
| `.github/workflows/add-approved.yml` | Adds an approved submission to the catalog |
| `.github/workflows/setup-labels.yml` | Creates the labels, run once |
| `MODERATION.md` | Guide for moderators |
| `scripts/check-links.mjs`, `scripts/lib/link-check.mjs` | The link checker |
| `.github/workflows/check-links.yml` | Runs the link checker every Monday and manages the report issue |
| `RUNBOOK.md` | What to do when the site is down or something breaks |
| `.github/workflows/deploy.yml` | Checks, builds and publishes the site |
| `.github/ISSUE_TEMPLATE/` | The submission and report forms |

## How search works

At build time the site writes `search-index.json`, one small record per material. The search page downloads it once, then searches in the browser as you type. Every word you type must match (an unfinished word like "recurs" still finds "recursion"). A title match counts most, then the course code, course name, type and semester, then the description. The Course, Type and Semester filters are exact, and the address bar always holds the current search, so a search can be shared as a link.

This is plenty for a few thousand materials. When `dist/search-index.json` passes about 1 MB (roughly 3,000 materials), or search feels slow on a cheap phone, switch to [Pagefind](https://pagefind.app). Only `src/lib/search-core.js` and `src/scripts/` need to change.

## Limits to know

GitHub Pages is free for public repositories. A published site may be at most 1 GB, with a soft limit of about 100 GB of traffic a month. Linking to files (instead of storing them here) keeps you far below both.

## Before real material goes in

Ask your department or a professor what may be shared, finish the content policy, and add a takedown contact to it. Add a license file before accepting outside contributions.
