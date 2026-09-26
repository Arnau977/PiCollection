---
name: pr-flow
description: Use in PiCollection when starting a new piece of work, committing, opening or updating a pull request, or after a PR is approved/merged - branch hygiene, commit and PR conventions, and syncing back to master.
---

# PR flow

## Starting work

```bash
git switch master && git pull --ff-only
git switch -c <type>/<short-name>        # feat/, fix/, docs/, tooling/, release/
```

## Before committing

1. `bash .claude/skills/verify/verify.sh` (the **verify** skill).
2. The **docs-sync** skill: update the docs the change affects, in the same PR.
3. Renderer UI changes: the **design-council** skill has already been run.
4. The branch has no PR yet, or only an open one:
   `gh pr list --head <branch> --state all`. A squash-merged branch must
   never get new commits; start a new branch from master instead.

## Commit and PR conventions

- Everything in English (code, comments, commits, PRs). Only the chat
  follows the conversation's language.
- Commit message: an imperative title, then a body that says **why**. End it
  with the attribution lines the session provides.
- PR body sections:
  - `## Summary` - what changed and why, with the root cause for a bug.
  - `### Design council` - for UI changes: the judges' votes, any
    disagreement and how it was resolved, the contrast ratios checked.
  - `## Test plan` - `[x]` for what you ran (name any failures and why),
    `[ ]` for the manual checks left to the user.
  - `## Release note bullets` - user-facing, one line each.
  - End with the session's PR attribution line.
- One PR per step of a multi-step plan. Stop after each one and wait for
  the user.

## After review

Don't wait to be told: check `gh pr view <n> --json state` whenever the
next step depends on it. Once merged:

```bash
git switch master && git pull --ff-only
```

Open PRs touching the same files may now conflict: rebase them onto master
(`git rebase master`, `git push --force-with-lease`) before the user merges.
