# Moderation guide

Nothing appears in the library until a moderator approves it.

## One-time setup

1. Open the **Actions** tab, choose **Create labels**, and press **Run workflow**. It creates the labels `submission`, `report` and `approved`.
2. Give each moderator **Write** access (Settings, then Collaborators). Only people with access can add labels, so only they can approve.

## Approving a submission

1. Open the issue and read it.
2. Open the link in a private (incognito) window. It must open without logging in, and it must match the title and course.
3. Check the stated reason it may be shared (see the content policy). Say no to pirated books, leaked or upcoming exams, solutions to assignments that are still open, and anything with other people's personal details.
4. Add the label **approved** (right side of the issue, under Labels).
5. Within a minute the helper adds the entry, replies with the link and closes the issue. The site updates a minute or two later.

If the helper lists problems, it removes the label. Edit the issue text to fix them (you or the submitter can), then add **approved** again.

The helper never opens the link itself, so step 2 is your job. Afterwards a weekly check visits every link and opens an issue labelled `link-check` when some break (see `RUNBOOK.md`).

## Saying no

Comment with the reason, then close the issue as **not planned**.

## Removing something

Remove first, discuss afterwards.

1. Open `src/data/materials.json` on GitHub and press the pencil (Edit). Delete that entry: the block from `{` to `}`, plus one neighbouring comma. Commit.
2. The build checks the file, so a slip stops the update instead of breaking the site. Fix the slip and commit again.
3. Reply to the person who reported it.

## Trying the helper on your computer

Save an issue's text in a file and run `npm run add -- --body issue.txt --dry-run`. It prints the entry it would add and saves nothing.
