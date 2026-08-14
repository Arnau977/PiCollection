# PiCollection

A local-first desktop gallery for images, GIFs and videos, built with Electron,
React and TypeScript. Media stays on disk exactly where it already is —
PiCollection only indexes it in a local SQLite database, so you can tag,
browse and filter a personal collection without uploading anything anywhere,
with one explicit, opt-in exception: the "Suggest tags" button (see below)
sends a thumbnail to saucenao.com only when you press it.

## For users

This section is for anyone who just wants to run the app - no coding
required.

- **Download**: grab the installer for your OS (Windows/macOS/Linux) from
  the [GitHub Releases page](https://github.com/Arnau977/PiCollection/releases)
  and run it. The app checks for new versions itself afterwards
  (**Settings → Updates**), with an optional beta channel.
- **What it does**: see [Features](#features) below for the full list -
  tagging, gallery search, NSFW handling, backup/restore, duplicate
  detection, and tag suggestions (both an online one via SauceNAO and an
  offline one that runs entirely on your machine).
- **Your data stays local**: your media files never move or get uploaded.
  The only network activity tied to your content is opt-in: pressing
  "Suggest tags" sends a thumbnail to SauceNAO, and enabling local tag
  suggestions downloads a one-time tagging runtime the first time you use
  it. Everything else (browsing, tagging, search, backups) never leaves
  your machine.

## Features

- **Tagging** — attach Artists, Tags, Characters and Series to each item, with
  Characters/Series linked many-to-many.
- **Gallery search** — a single text field that suggests tags/characters/
  series/artists and supports `AND` (space), `OR`, `-exclude` and
  `(parentheses)` for grouping, e.g. `(Ishtar OR Ereshkigal) -Fujimaru`.
- **Fast thumbnails** — grid and list views load a small cached preview
  instead of the original file; GIFs and videos only animate on hover.
- **NSFW handling** — mark media as NSFW, optionally blur it in listings, and
  reveal on click.
- **Home dashboard** — recent additions plus a quick stats summary of your
  most-tagged artists/tags/characters/series.
- **Window state** — remembers the app window's size and position between
  launches.
- **Auto-update** — checks GitHub Releases for new versions, with an opt-in
  beta channel; see [`docs/auto-update.md`](docs/auto-update.md).
- **Tag suggestions** — on the add/edit media form, "Suggest tags" sends a
  thumbnail to [SauceNAO](https://saucenao.com) to find the source artwork
  and pre-fill its known artist/characters/series/tags. Works on images,
  GIFs and videos (via the same poster-frame/first-frame thumbnail already
  used elsewhere). Suggestions that match an existing character/series by
  name or alias are applied silently instead of being offered again. When
  the match includes a known artist social profile (Pixiv, Twitter/X), it's
  linked automatically if you create that artist from the suggestion.
  Requires a free SauceNAO API key set in Settings — SauceNAO no longer
  allows anonymous API access at all, so the suggestions button doesn't
  appear at all until a key is configured. This is the only feature that
  sends anything off your machine, and only on that explicit button press.
- **Backup & Restore** — export the whole library (database, tags, settings,
  gallery preferences) to a single `.zip` from Settings, and restore it as a
  full replace on any install. A separate "Missing files" tool detects media
  whose files moved and bulk-relinks them to a new folder in one step,
  without ever needing to re-copy the files themselves.
- **Duplicate detection** — adding media checks the new file's path and
  content against what's already in the library: an exact match (same file,
  even from a different path) blocks the add, and a visually similar file
  (e.g. a recompressed or resized copy) shows a non-blocking warning.

## For developers

Everything from here down is for people building or contributing to
PiCollection itself.

### Tech stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) — desktop shell and build tooling
- React 18 + TypeScript, [react-router-dom](https://reactrouter.com/) (`HashRouter`), [react-aria-components](https://react-spectrum.adobe.com/react-aria/) for accessible primitives
- [Kysely](https://kysely.dev/) over [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — typed SQL, plain `.ts` migrations, no ORM magic
- [Zod](https://zod.dev/) validation at the IPC boundary between renderer and main process
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)

### Requirements

- Node.js **20** or newer
- On Windows, a working C++ toolchain if `better-sqlite3` needs to compile
  from source (a prebuilt binary is normally used instead, so this is rarely
  needed)

### Getting started

```bash
npm install
```

`npm install` also builds `better-sqlite3` for Electron's Node ABI via the
`postinstall` script, so the app can open a database as soon as install
finishes.

#### Development

```bash
npm run dev
```

Starts the app with hot reload. In dev mode the database lives at
`picollection.dev.sqlite` inside Electron's `userData` directory (separate
from the packaged app's `picollection.sqlite`, so day-to-day development
never touches real collection data). Migrations run automatically on
startup — nothing to run by hand.

#### Tests

```bash
npm test
```

Runs the full Vitest suite. Because `better-sqlite3` is a native module
compiled against a specific runtime's ABI, this script automatically
rebuilds it for plain Node before the run (`pretest`) and rebuilds it back
for Electron afterwards (`posttest`), so `npm run dev` keeps working right
after. Use `npm run test:watch` for a watch-mode run during active
development.

#### Linting & type checking

```bash
npm run lint        # eslint --fix
npm run typecheck    # tsc, main + renderer configs
```

#### Building

```bash
npm run build         # typecheck + electron-vite build, no installer
npm run build:win     # + electron-builder, Windows installer
npm run build:mac     # + electron-builder, macOS
npm run build:linux   # + electron-builder, Linux
```

Packaged builds land in `dist/`; unsigned/unpacked output for quick local
testing is available via `npm run build:unpack`.

#### Releases & auto-update

Pushing a `v*` tag (e.g. `v1.2.0`, or `v1.2.0-beta.1` for a beta) triggers
`.github/workflows/release.yml`, which builds Windows/macOS/Linux installers
and publishes them to a GitHub Release. The app checks that same repo for
updates and lets the user download/install from **Settings → Updates**, with
a stable/beta channel choice. See [`docs/auto-update.md`](docs/auto-update.md)
for the full flow.

#### Database migrations

Schema changes live as plain TypeScript files in
`src/main/database/migrations/`, applied in order at app startup. When
working on the schema outside the Electron app (e.g. scripting against a
throwaway database), a few extra commands are available:

```bash
npm run migrate:create <name>   # scaffold a new migration file
npm run migrate:up               # apply pending migrations to .data/picollection.dev.sqlite
npm run migrate:down             # roll back the last migration
```

These use a local file at `.data/picollection.dev.sqlite` (ignored by git);
set `DB_PATH` to point them elsewhere. This is independent of the database
the Electron app itself opens under `userData`.

### Project layout

```
src/
  main/            Electron main process: database, IPC handlers, thumbnails, window state
    database/
      migrations/  Schema history, one file per migration
      repositories/ Kysely queries, one file per entity
    services/      Business logic between repositories and IPC
    ipc/           IPC channel handlers (validated with zod)
  preload/         Bridges main <-> renderer through `window.api`
  renderer/src/    React app (pages, components, hooks)
  shared/          Code imported by both main and renderer: models, IPC
                    contracts, the search-query parser
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how a request flows
from the UI down to SQLite and back, and for a worked example of adding a new
entity or field.

### Recommended IDE setup

[VS Code](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
