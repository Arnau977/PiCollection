# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PiCollection: a local-first Electron desktop gallery for images/GIFs/videos.
Electron + electron-vite, React 18 + TypeScript (renderer), Kysely over
better-sqlite3 (main process, plain `.ts` migrations, no ORM magic), Zod
validation at the IPC boundary, Vitest + Testing Library for tests. See
`docs/guide/` (user guide, one page per area) for user-facing behavior;
`README.md` only summarizes the features.

## Commands

```bash
npm install          # also builds better-sqlite3 for Electron's ABI (postinstall)
npm run dev           # electron-vite dev, hot reload; db at userData/picollection.dev.sqlite
npm test              # full vitest suite (prefer the verify skill)
npm run test:watch    # watch mode
npx vitest run <path>                       # single file
npx vitest run <path> -t "<test name>"      # single test
npm run lint           # eslint --fix, repo-wide - avoid on this checkout (see verify skill)
npm run typecheck       # tsc, node config + web config
npm run build            # typecheck + electron-vite build
npm run build:win|mac|linux   # + electron-builder installer
npm run icons            # regenerate every app icon from resources/logo.svg
npm run migrate:create <name>   # scaffold a migration
npm run migrate:up / migrate:down   # apply/roll back against .data/picollection.dev.sqlite
```

**Verifying a change:** use the `verify` skill
(`bash .claude/skills/verify/verify.sh`). It handles the better-sqlite3 ABI
flip between Node (tests) and Electron (app), lints only the changed files
without this checkout's CRLF noise (never run the bare `npm run lint`), and
recognizes the known port-8934 test failures while the app is open. For
commits/PRs and releases, the `pr-flow`, `docs-sync` and `cut-release` skills
hold the conventions.

## UI/UX & performance

Any renderer UI/UX work (a new or redesigned screen, a moved button, layout,
styles, colors, empty/loading/error states) **must** go through the
`design-council` skill before deciding the approach: the four-judge council
(UI 30% / UX 30% / accessibility 20% / desktop structure 20%) plus the
repo's layout rules (no scrolling to reach critical controls, no duplicated
info, reuse existing patterns). Every color pair is checked with the
`contrast-check` skill.

## Changes made from other projects

Some changes here are made from Claude Code sessions opened in other
projects (e.g. the PiCollection Capture extension in
`C:\MyProjects\PiCollection_Capture`). They're logged, with origin,
purpose, files and release-note bullets, in `docs/external-changes.md`.
Check it when you find unexplained uncommitted changes or when preparing
release notes. Any session editing this repo from elsewhere adds an entry
there.

The opposite direction is logged too: a session here that edits the
extension adds an entry to `C:\MyProjects\PiCollection_Capture\docs\external-changes.md`
(that repo has no git history yet, so the log is its only record).

## Working style

- Use tokens/context economically: don't re-read files already seen in the
  conversation, don't restate things already established, keep exploration
  and responses tight.
- Write fewer tests: cover the real behavior/edge cases without piling on
  redundant or low-value cases. This is about how many tests get written,
  not about skipping test runs - still run the full suite before anything
  high-stakes (a release, pushing to an open PR).
- Don't spawn subagents - do the work directly in this session. Only
  exception: work spanning more than one repo (e.g. this app plus the
  PiCollection Capture extension) may use subagents to parallelize, but the
  plan must say so explicitly (which repo/part each subagent takes) and the
  user must approve it before any subagent is launched.
  Second exception: a subagent may act as a **reviewer** (e.g. the final
  whole-branch review of a plan or PR), never as the implementer.
- Keep files human-readable: no need to force files tiny, but when one grows
  large enough to become hard to navigate (a component/hook mixing several
  distinct concerns), split it - extract hooks for logic and components for
  separate visual blocks - instead of letting it keep growing. See
  `src/renderer/src/pages/Media/MediaForm/MediaForm.tsx` and its sibling
  `useMediaForm*`/`MediaForm*`/`*SuggestionsPanel` files for the pattern.
- Everything public is written in English, regardless of what language the
  conversation itself is in: code, code comments, commit messages, PR
  titles/descriptions, and documentation/READMEs. Only the conversation
  with the user follows the conversation's own language. The one exception
  is in-app user-facing strings (`src/renderer/src/assets/locales/`), which
  stay translated per their own locale.

## Architecture

Full details, plus two fully worked examples (adding a field to `Media`,
adding a new tagging entity), live in `docs/ARCHITECTURE.md` — read it before
touching the DB/IPC layers. Summary:

The renderer is sandboxed (no Node/filesystem access) and never touches the
database directly; every read/write crosses into the main process over IPC:

```
React component
  -> hook (useTags, useMediaQuery, ...)        src/renderer/src/hooks/
  -> window.api.<entity>.<method>(...)         src/preload/index.ts
  -> ipcRenderer.invoke(channel, payload)       -------- IPC boundary --------
  -> ipcMain.handle(channel, ...)               src/main/ipc/<entity>.handlers.ts
  -> zod validation (ipcHandler wrapper)        src/main/ipc/helpers.ts
  -> service (business logic, DB<->model)       src/main/services/<entity>.service.ts
  -> repository (Kysely queries only)           src/main/database/repositories/<entity>.repository.ts
  -> SQLite
```

Key invariants:

- **`src/shared/ipc/contracts.ts`** (the `IPC` channel-name map + zod
  `*Schema` exports) is the single source of truth for the IPC surface. Both
  `src/main/ipc/*.handlers.ts` and `src/preload/index.ts` import from it —
  there's no code generation, so adding a channel means updating both by
  hand, starting from `contracts.ts`.
- **Repositories only know SQL**: raw DB row shapes (snake_case, `0`/`1`
  booleans, epoch `number` timestamps, per `src/main/database/schema.ts`).
  They never see a `*Model` type.
- **Services own DB row <-> camelCase `*Model` mapping** (`src/shared/models/`)
  and cross-entity rules (e.g. validating a referenced `artistId` exists).
- **`src/shared/`** is importable from both processes (`@shared/*` alias in
  both tsconfigs) — anything needed on both sides of IPC (models, contracts,
  the gallery search-query parser) belongs there, not duplicated.
- **Every IPC handler is wrapped in `ipcHandler(channel, schema, fn)`**
  (`src/main/ipc/helpers.ts`), which validates the payload and always
  resolves to `IpcResult<T>` (`{ success, data } | { success: false, error }`)
  instead of throwing across the boundary — renderer code checks
  `result.success`, not try/catch.
- **Migrations are append-only.** Once shipped, a migration file in
  `src/main/database/migrations/` is immutable — schema changes are always a
  new migration, registered in `migrations/index.ts`, even for one column.
- **Not everything is request/response.** A few channels are pushed from
  main to the renderer unprompted (`webContents.send` / `ipcRenderer.on`,
  not `invoke`): `updater:event` (see `docs/auto-update.md`),
  `entities:changed` (`src/main/events/entityEvents.ts` — refetch hints for
  entity lists), `auto-backup:changed`, `wd14-runtime:event`,
  `auto-import:added` (`src/main/events/autoImportEvents.ts` - "N pictures
  added to Pending" toast) and `notifications:changed`
  (`src/main/services/notifications/` — the sidebar bell's list, recomputed
  when the updater, backups or media announce a change on
  `src/main/events/appStateEvents.ts`).
- Tests don't need an Electron runtime: `initTestDbSingleton()`
  (`src/main/database/testHelpers.ts`) spins up a real temporary SQLite file
  per test, migrated the same way the app migrates on startup.

### Gallery filtering shape

Media list filters (`MediaFilters` in `src/shared/models`) use an
OR-of-AND-groups shape for tags/characters/series (`tagGroups`,
`characterGroups`, `seriesGroups`: `string[][]`), plus a free-text `query`
parsed by `src/shared/query/searchQuery.ts` (AND via space, `OR`, `-exclude`,
`(grouping)`) matched against tag/character/series/artist/media names.
Selecting a specific tag/character/series suggestion from the search bar
applies it as a structured group filter instead of inserting text — this
matters for series and characters, since only the structured
`seriesGroups`/`characterGroups` paths expand through the parent/child
hierarchy (a filter on a parent also matches media tagged only with a
descendant, via `buildClosureMap` in
`src/main/database/repositories/entityHierarchy.ts`). A character's "inspired by" links
(`character_inspired_by`, an expy and her original) are not a hierarchy and
never expand; they only make tag suggestions hold the original back
(`HeldCharacter` in `hooks/tagSuggestionMatching.ts`). Ids listed in
`exactCharacterIds`/`exactSeriesIds` skip that expansion and match only
direct links. A group entry prefixed with `-` is an exclusion ("must not
have it"), parsed by `src/shared/query/groupEntry.ts` - always go through
it rather than reading group entries as bare ids.

Pending media (`pending_tagging = 1`) is a staging area, not library
content: the gallery, entity thumbnails, similar-media panel, Metadata
counts (`mediaCount`; `pendingMediaCount` exists only for delete
confirmations) and Home rankings all exclude it. Duplicate detection,
missing-file checks and backups include it. Resolving it
(`clearPendingTagging`) resets its added date and links its characters to
its sole series.

A media's tags are its own (`media_tag`) plus the automatic ones: rules in
`auto_tag_rule` (Settings > Automatic tags) matched at query time against
the size/transparency stored on `media` (`width`/`height`/`has_alpha`, read
in the background by `autoTags.service.ts`). Anything that *reads* tags -
filters, search, counts, rankings, thumbnails - goes through
`effectiveMediaTags` / `MEDIA_MATCHES_RULE`
(`src/main/database/repositories/autoTag.repository.ts`); writes still go
to `media_tag` only, and `MediaModel.autoTagIds` keeps automatic ones out of
the edit form's saved tags.

Deleting media never deletes its file: `mediaService.deleteMedia` records
the route in `discarded_media` (so do discarding an unsaved batch-import
file and `mediaService.replaceMedia` for the file a similar media gave up),
listed under Metadata > Discarded. A batch import's `expandSelection`
skips discarded routes, and adding a file again removes its record. The only
code that touches the file itself is `discardedMediaService.trashFiles`
(`shell.trashItem`, i.e. the Recycle Bin).

### Where things live

| Concern | Path |
|---|---|
| DB row shapes | `src/main/database/schema.ts` |
| Migrations | `src/main/database/migrations/*.ts` (+ `index.ts` registry) |
| SQL queries | `src/main/database/repositories/*.repository.ts` |
| Business logic, row<->model mapping | `src/main/services/*.service.ts` |
| IPC channel names + zod schemas | `src/shared/ipc/contracts.ts` |
| IPC handlers | `src/main/ipc/*.handlers.ts` (registered in `registerIpcHandlers.ts`) |
| Renderer-facing API surface | `src/preload/index.ts` |
| Cross-boundary types | `src/shared/models/*.ts` |
| Data-fetching hooks | `src/renderer/src/hooks/*.ts` |
| Gallery search parser | `src/shared/query/searchQuery.ts` |
| Pages/components | `src/renderer/src/pages/`, `src/renderer/src/components/` |
| Auto-update | `src/main/updater/` (see `docs/auto-update.md`) |
| Debug logging (settings, rotation, logger) | `src/main/logging/` |
| SauceNAO tag suggestions | `src/main/services/sauceNao/` — the only module that sends user content (a thumbnail, or for a video the paused preview frame at thumbnail size) off the machine, and only on an explicit button press. Other outbound calls: the matched picture's SauceNAO thumbnail (saucenao.com hosts only, fetched in main as a data: URL since the renderer CSP loads no remote images), update checks (GitHub), the one-time local-AI runtime download, and Danbooru text lookups (tag wiki, optional account-based autocomplete, a SauceNAO-matched Danbooru post's tags, characters and copyrights, account-based character-tag resolution in `danbooruCharacters.service.ts`) |
| Video to GIF | `src/renderer/src/pages/Media/VideoToGif/` (frames grabbed from a `<video>` on a canvas, encoded with `gifenc` in a Web Worker) + `src/main/services/videoGif.service.ts` (saves it next to the video, copies its metadata). Needs the `app:` scheme's `corsEnabled` + `Access-Control-Allow-Origin` (`src/main/media-protocol.ts`) so the canvas isn't tainted. `media.derived_from_id` links the GIF to its video, and `findSimilarMedia` lists such relatives first |
| Disk space page | `src/main/services/storage.service.ts` (`aggregateStorage`: library/pending/discarded totals, folders, entities through the hierarchy) + `src/renderer/src/pages/Storage/`; sizes from `media.file_size` (`fileSizes.service.ts`) |
| Discarded files (deleted media still on disk) | `src/main/services/discardedMedia.service.ts` + `discarded_media` table; UI in `src/renderer/src/pages/Manage/DiscardedManager.tsx` |
| Licenses | `LICENSE` (MIT); `scripts/generate-third-party-notices.mjs` writes `resources/third-party-notices.txt` (gitignored) before `dev`/`build`, opened from Settings > Advanced. A new bundled dependency with an unusual license (LGPL like libvips, anything copyleft) also gets a line in README "Third-party licenses" |
| Browser extension bridge | `src/main/services/extensionBridge.*.ts` — local HTTP API on 127.0.0.1 for PiCollection Capture; captures always go to Pending, start SFW, never create entities and link only a sole credited artist - the rest is source metadata offered as suggestions |
| Source-folder watcher | `src/main/services/sourceFolderWatcher/` - recursive `fs.watch` on the source folder while the app runs; a settle-and-batch queue (`settleQueue.ts`) feeds one sequential pass (`processNewFiles.ts`) that relinks moved/renamed media by content hash, skips copies and discarded files (`discarded_media.hash`), and - with auto-import on (`watcherSettings.ts`, off by default) - adds files created after it was turned on to Pending |
| Video player | `src/renderer/src/components/VideoPlayer/` - app-styled controls over a native `<video>` (detail page, Lightbox, edit-form preview): `useVideoPlayer` (state + remembered loop/volume/mute), `usePlayerShortcuts` (keys for the player in front; only when nothing else on the page is focused; arrows only with keyboard focus inside it, so the media page keeps them for previous/next - `inputModality.ts` tells keyboard focus from a click's) |
