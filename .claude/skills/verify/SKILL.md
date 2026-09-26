---
name: verify
description: Use in PiCollection whenever checking that a change works - before saying something is done, before committing, before a PR, and before telling the user to run the app. One script runs typecheck, lint of changed files, tests and the Electron rebuild, and reports only what needs attention.
---

# Verify

```bash
bash .claude/skills/verify/verify.sh            # full suite - before a PR or release
bash .claude/skills/verify/verify.sh --changed  # only tests affected by changes vs master - while iterating
bash .claude/skills/verify/verify.sh --no-tests # typecheck + lint only
```

Exit code 0 means clean. What it handles so you don't re-derive it:

- **Lint** only runs on `.ts/.tsx` files changed against master (plus
  uncommitted and new ones), with `--no-fix`. It filters out
  `prettier/prettier: Delete ␍`, which is this Windows checkout's autocrlf
  noise. Never run the bare `npm run lint`: it rewrites line endings across
  the whole repo. Warnings on lines you didn't touch are pre-existing; fix
  only yours.
- **better-sqlite3 ABI**: rebuilds it for Node before the tests and **always**
  rebuilds it back for Electron at the end, even if tests fail. So after this
  script the user can run the app without the `NODE_MODULE_VERSION`
  "Database error".
- **Known environmental failure**: the 2 `extensionBridge.server.test.ts`
  cases fail with `EADDRINUSE 127.0.0.1:8934` whenever the PiCollection app
  is open, because they bind the bridge's real port. The script labels them
  "known" when `PiCollection.exe` is running. When a fully green run matters
  (a release), ask the user to quit the app from the tray (the window X only
  hides it in background mode).

Report the result plainly: the counts it printed, and anything left failing
with the reason. If you ran `npx vitest` by hand afterwards, run
`npm run rebuild` before handing off.
