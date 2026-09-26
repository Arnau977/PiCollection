---
name: docs-sync
description: Use in PiCollection before committing or opening a PR for any change that adds, removes or alters a feature, workflow, file path, IPC channel, setting, network call or release step - finds which Markdown docs the change affects and updates them in the same PR.
---

# Docs sync

Docs are part of the change, not a follow-up. Before committing:

## 1. Map the change to the docs it can affect

| If the change touches... | Check |
|---|---|
| A user-visible feature, setting or behavior | `README.md` → "For users" and "Features" |
| Anything that sends data off the machine (new `fetch`, URL, download) | `README.md` privacy paragraph (intro + "Your data stays local"), `CLAUDE.md` "Where things live" |
| Dev commands, requirements, build, tests, migrations | `README.md` "For developers", `CLAUDE.md` "Commands" |
| Layering, IPC surface, push channels, invariants (e.g. what pending excludes) | `CLAUDE.md` "Architecture", `docs/ARCHITECTURE.md` |
| Moving or renaming a file that a doc cites | every doc citing it (step 2 finds them) |
| Updater, release workflow, versioning | `docs/auto-update.md`, `README.md` "Releases & auto-update" |
| The browser extension or its bridge contract | `docs/external-changes.md` here if edited from the extension; `C:\MyProjects\PiCollection_Capture\docs\external-changes.md` if this session edits the extension |

Only edit a section when the change actually makes it wrong or incomplete.
Keep the existing tone, structure and level of detail.

## 2. Check that the paths cited in the docs still exist

```bash
for f in README.md CLAUDE.md docs/*.md; do
  grep -oE '(src|resources|\.github)/[A-Za-z0-9_./-]+' "$f" | sed 's/[.,)]*$//' | sort -u |
    while read -r p; do [ -e "$p" ] || echo "$f: missing $p"; done
done
```

The worked examples in `docs/ARCHITECTURE.md` (`0004_media_rating.ts`,
`location.*`) are hypothetical on purpose; ignore those.

## 3. Rules

- Everything public stays in English (see `CLAUDE.md`).
- A scripted edit (`sed`/`perl`) can silently match nothing in this CRLF
  checkout: confirm it with `git diff --stat` before saying a doc was
  updated.
- Mention the doc updates in the PR summary, one line each.
