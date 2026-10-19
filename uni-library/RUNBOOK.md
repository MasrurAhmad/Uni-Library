# Runbook: keeping the library up

The site is static files on GitHub Pages, so there is no server to crash. What can still go wrong: a bad change, a broken deploy, a GitHub outage, a locked account, or links that die. This page says what to do.

## What watches the site

- Every change must pass the catalog check, the tests and the build before it goes live.
- The **Check links** workflow visits every material's link each Monday and keeps one issue labelled `link-check` up to date.
- A free uptime monitor outside GitHub emails you if the site stops answering (set it up below).

## Set up the uptime monitor (about 10 minutes, once)

1. Create a free account at uptimerobot.com. Confirm the email address.
2. Add a monitor: type **Keyword**, URL `https://YOUR-NAME.github.io/REPO-NAME/`, keyword `Uni Library`, alert when the keyword is **not** found. Checks run every 5 minutes on the free plan.
3. Add a second keyword monitor for `https://YOUR-NAME.github.io/REPO-NAME/search-index.json` with the keyword `records`. It proves that the data is being served too.
4. Make sure your email is an alert contact on both. Confirm that both show **Up**.

The free plan's limits and terms can change, so read them when you sign up. This is a non-commercial student project.

## When an alert arrives

1. **Check GitHub's status page** (githubstatus.com). If GitHub Pages has an incident, wait. Nothing you do will help.
2. **Open the Actions tab.** Is the latest "Check, build and deploy" run green? If it is red, open it and read the last red line first. Usual causes: a bad catalog entry (the message says which one), Pages switched off in Settings, or Actions permissions changed.
3. **Was the last change bad?** Open the commit list, open the bad commit, use the menu to **Revert**, and merge the pull request it creates. The deploy starts by itself.
4. **Still broken?** Open the last green run in the Actions tab and press **Re-run all jobs**. That publishes the last good version again.
5. Say what happened to your users in one line wherever they follow you.

## Bad entry, copyright complaint, or something that must go now

Remove it first and talk afterwards. Steps are in `MODERATION.md`, under "Removing something".

## Habits

- **Monday:** if the `link-check` issue is open, work through it.
- **Every two months:** open Actions, choose **Check links**, and make sure it is enabled and ran recently. In a public repository GitHub turns scheduled workflows off after 60 days without repository activity. Press **Run workflow** to wake it. An approved submission or any commit also counts as activity.
- **Monthly:** download a copy (Code, then Download ZIP) and keep it somewhere that is not GitHub. The whole library is in `src/data/`, so a copy is a complete backup. To restore, upload the files again.
- **When Dependabot opens a pull request:** merge it if the checks are green.
- **Twice a year:** all workflows use the pinned runner `ubuntu-24.04`. GitHub is moving `ubuntu-latest` to Ubuntu 26.04 between 19 October and 19 November 2026. Test `ubuntu-26.04` on a branch (the checks run on pull requests), then change `runs-on` in every workflow file together.

## Protect the accounts

- Turn on two-factor authentication on GitHub (Settings, then Password and authentication). Save the recovery codes somewhere offline.
- Add a trusted second maintainer as a collaborator, so the site survives your exams, your travel and your graduation. Make sure they have read this file.
- Do not turn on "Require a pull request before merging" for `main`. The submission helper adds entries directly. Blocking force pushes is fine.

## Exam weeks

- Freeze changes the week before midterms and finals. Approving submissions is fine. Code and settings changes wait.
- The day before, check that both monitors show **Up** and the latest deploy is green.

## After any incident

Write five lines in `docs/incidents/YYYY-MM-DD.md`: what happened, how you found out, how you fixed it, how long it lasted, and what you will change so it does not happen again.

## Limits to remember

GitHub Pages sites may be at most 1 GB, with a soft limit of about 100 GB of traffic a month. Linking to files instead of storing them keeps the library far below both.
