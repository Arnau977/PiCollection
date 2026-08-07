# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PiCollection: a local-first Electron desktop gallery for images/GIFs/videos.
Electron + electron-vite, React 18 + TypeScript (renderer), Kysely over
better-sqlite3 (main process, plain `.ts` migrations, no ORM magic), Zod
validation at the IPC boundary, Vitest + Testing Library for tests. See
`README.md` for the full feature list and user-facing behavior.

## Commands

```bash
npm install          # also builds better-sqlite3 for Electron's ABI (postinstall)
npm run dev           # electron-vite dev, hot reload; db at userData/picollection.dev.sqlite
npm test              # full vitest suite (see ABI note below)
npm run test:watch    # watch mode
npx vitest run <path>                       # single file
npx vitest run <path> -t "<test name>"      # single test
npm run lint           # eslint --fix (see line-ending caution below)
npm run typecheck       # tsc, node config + web config
npm run build            # typecheck + electron-vite build
npm run build:win|mac|linux   # + electron-builder installer
npm run migrate:create <name>   # scaffold a migration
npm run migrate:up / migrate:down   # apply/roll back against .data/picollection.dev.sqlite
```

**better-sqlite3 ABI:** the native module is compiled for one runtime at a
time. `npm test`'s `pretest`/`posttest` hooks rebuild it for plain Node, then
back for Electron, automatically. If you invoke `npx vitest run` directly
(bypassing `npm test`) and it wasn't already rebuilt for Node, DB-touching
tests fail with a `NODE_MODULE_VERSION` mismatch (often surfacing as
`cleanup is not a function` in `afterEach`, which masks the real error) — fix
with `npm rebuild better-sqlite3`. Before running the Electron app again
afterwards, flip it back with `npm run rebuild`.

**Lint caution on Windows checkouts:** if `core.autocrlf=true` and no
`.gitattributes` pins line endings, a bare `npm run lint` (repo-wide,
`--fix`) can rewrite CRLF→LF across most of the tree as an unrelated side
effect. Prefer linting just the files you touched, e.g.
`npx eslint --no-fix <changed files>`, before running the full autofix.

## UI/UX & performance

When touching the renderer, treat UI/UX and perceived performance as part of
the task, not a follow-up:

- Don't make the user scroll to discover something they need immediately
  (an action button, pagination, an error) — bound the page to the viewport
  with its own inner scroll region rather than letting critical controls
  scroll out of view (see `.gallery-page`/`.manage-page`/`.add-media-page` +
  their `*-scroll-region` pattern for the established approach, including why
  `position: sticky` was rejected in favor of it).
- Don't duplicate the same information or control twice on one page/view
  without a reason (e.g. a count already shown by a button's own label).
- Reuse existing components/classes/patterns instead of inventing a new one
  for something the app already has a convention for — keep visual and
  functional behavior consistent across pages (spacing, empty/error/loading
  states, button placement, pagination behavior, etc.).

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
- **Not everything is request/response.** The auto-updater is the one place
  main pushes to the renderer unprompted over `updater:event`
  (`ipcRenderer.on`, not `invoke`) — see `docs/auto-update.md`.
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
matters for series in particular, since only the structured `seriesGroups`
path expands through the parent/child series hierarchy (a filter on a parent
series also matches media tagged only with a descendant series, via
`buildSeriesClosureMap` in `src/main/database/repositories/seriesHierarchy.ts`).

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
| SauceNAO tag suggestions | `src/main/services/sauceNao.*.ts` — the only module making outbound network calls for user content, and only on an explicit button press |
