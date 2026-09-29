---
name: cut-release
description: Use in PiCollection when the user asks to release, bump the version ("sube versión", patch/minor), publish, re-release or promote a build - covers the release branch, tag, build watch, Highlights and the draft/published safety checks.
---

# Release

Full background: `docs/auto-update.md`. Versions are plain `X.Y.Z`: patch
for a set of fixes, minor for a bigger batch or a significant feature. The
PiCollection Capture extension is **not** versioned with the app (it stays
0.1.0 until it's on git).

## 0. Check state first - never assume it

```bash
gh release list --limit 5          # Draft / Pre-release / Latest
gh pr list --state open            # anything that should ship first?
```

- **Never delete or overwrite a published release** (Pre-release or Latest)
  without the user's explicit OK for that exact release. Installs keep
  working, but its page, installers and tag disappear. Fix forward with the
  next patch.
- Don't chain the state check and a destructive `gh release` command in one
  call: read the state, then decide.

## 1. Cut it

```bash
git switch master && git pull --ff-only
bash .claude/skills/verify/verify.sh      # ask the user to quit the app for a fully green run
git switch -c release/X.Y.Z
npm version X.Y.Z --no-git-tag-version
git commit -am "X.Y.Z - <short theme>"   # body: the PRs it covers; attribution lines from the session
git push -u origin release/X.Y.Z
gh pr create --base master ...            # summary of covered PRs + "Suggested Highlights"
git tag -a vX.Y.Z -m "X.Y.Z" && git push origin vX.Y.Z   # tag the branch head
```

## 2. Watch the build (in the background, one notification)

```bash
run=$(gh run list --workflow Release --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$run" --exit-status --interval 30 >/dev/null; echo "exit=$?"
gh run view "$run" --json conclusion,jobs -q '.conclusion, (.jobs[] | .name+": "+.conclusion)'
```

The workflow leaves a **draft pre-release** with the installers (10 assets).

## 3. Highlights (2-3 user-facing bullets)

```bash
node .claude/skills/cut-release/fill-highlights.mjs vX.Y.Z "First" "Second" "Third"
```

It only edits drafts, and writes the section as a Markdown list because the
app's update panel shows it as bullets. "What's Changed" must list only
the PRs since the last published release (beta or stable): the workflow
starts the range there. If it spans more, fix the range - don't just
report it.

## 4. Hand off

Publishing is the user's call unless they asked you to publish:
- publish to beta: `gh release edit vX.Y.Z --draft=false` (stays pre-release)
- promote to stable: `gh release edit vX.Y.Z --prerelease=false --latest`

Tell the user the release URL, the draft/published state, and that the
release PR still needs merging.
