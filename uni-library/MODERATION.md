# Submission guide

Submissions are automatically added to the library. This guide covers how to manage the catalog and handle problems.

## How auto-submission works

1. A user submits through the form, which creates a GitHub issue with the `submission` label.
2. The workflow (`.github/workflows/add-approved.yml`) automatically adds the entry to `src/data/materials.json`, starts the deploy, replies with the link and closes the issue.
3. The site updates within a few minutes.

If the submission has validation problems, the workflow comments with the issues and leaves the issue open for correction.

## Handling invalid submissions

If a submission has problems, the workflow will comment and leave the issue open. You can:
1. Edit the issue text to fix the problems.
2. Close the issue as **not planned** if it shouldn't be added.

The workflow will automatically retry when the issue is edited.

## Removing something

Remove first, discuss afterwards.

1. Open `src/data/materials.json` on GitHub and press the pencil (Edit). Delete that entry: the block from `{` to `}`, plus one neighbouring comma. Commit.
2. The build checks the file, so a slip stops the update instead of breaking the site. Fix the slip and commit again.
3. Reply to the person who reported it.

## Trying the helper on your computer

Save an issue's text in a file and run `npm run add -- --body issue.txt --dry-run`. It prints the entry it would add and saves nothing.
