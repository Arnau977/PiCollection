# PiCollection

A local-first desktop gallery for images, GIFs and videos, built with Electron,
React and TypeScript. Media stays on disk exactly where it already is —
PiCollection only indexes it in a local SQLite database, so you can tag,
browse and filter a personal collection without uploading anything anywhere.
The one exception is explicit and opt-in: the "Suggest tags" button (see
below) sends a thumbnail to saucenao.com, and only when you press it.

## For users

This section is for anyone who just wants to run the app - no coding
required.

- **Download**: grab the installer for your OS (Windows/macOS/Linux) from
  the [GitHub Releases page](https://github.com/Arnau977/PiCollection/releases)
  and run it. The app checks for new versions itself afterwards
  (**Settings → Updates**), with an optional beta channel.
- **What it does**: see [Features](#features) below, or the
  [user guide](docs/guide/README.md) for how to use each part -
  tagging, gallery search, a Pending queue for media you'll tag later,
  batch import from folders, NSFW handling, backup/restore, duplicate
  detection, a browser extension, and tag suggestions (both an online one
  via SauceNAO and an offline one that runs entirely on your machine).
- **Your data stays local**: your media files never move or get uploaded.
  The only thing that ever sends your content anywhere is pressing
  "Suggest tags", which sends a thumbnail to SauceNAO. Other network use,
  all without your media:
  - checking GitHub for app updates;
  - a one-time download of the local tagging runtime and model, when you
    enable it;
  - Danbooru lookups by tag name: the tag-info button, tag autocomplete (only
    if you add a Danbooru account), the tags of a post SauceNAO matched, and,
    with a Danbooru account, the base character and series of a suggested
    character tag (cached for 30 days).

  Browsing, tagging, search and backups never leave your machine.

## Features

The [user guide](docs/guide/README.md) explains each of these step by step.

- **Tagging** - artists, tags, characters and series, with forms/costumes and
  subseries; forgiving pickers. [Tagging and suggestions](docs/guide/tagging.md)
- **Suggestions** - from the source site of a browser capture, SauceNAO
  (online, opt-in), or an AI tagger that runs entirely on your computer.
  [Tagging and suggestions](docs/guide/tagging.md#suggestions)
- **Adding media** - single files, batch import of whole folders, and a
  browser extension that captures posts. [Adding media](docs/guide/adding-media.md)
- **Pending queue and Discarded list** - tag later without cluttering the
  library; deleted media never deletes files, which you clean up from one
  place. [Pending and discarded](docs/guide/pending-and-discarded.md)
- **Duplicate detection** - exact and visually similar copies, a side-by-side
  comparison, and replacing a copy while keeping its tags.
  [Duplicates](docs/guide/duplicates.md)
- **Gallery search and filters** - AND/OR/exclude search, include/exclude
  filter chips, hierarchy-aware characters and series, NSFW blur, batch
  editing. [Gallery and search](docs/guide/gallery-and-search.md)
- **Viewing media** - full-size viewer with zoom, copy image (animated GIFs
  too), Video to GIF. [Viewing media](docs/guide/viewing-media.md)
- **Backups** - manual export/restore, automatic scheduled backups, and
  relinking files you moved. [Settings and backups](docs/guide/settings-and-backups.md)
- **Keyboard shortcuts** for the common actions.
  [Keyboard shortcuts](docs/guide/keyboard-shortcuts.md)

## For developers

Everything from here down is for people building or contributing to
PiCollection itself.

### Tech stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) — desktop shell and build tooling
- React 18 + TypeScript, [react-router-dom](https://reactrouter.com/) (`HashRouter`), [react-aria-components](https://react-spectrum.adobe.com/react-aria/) for accessible primitives
- [Kysely](https://kysely.dev/) over [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — typed SQL, plain `.ts` migrations, no ORM magic
- [sharp](https://sharp.pixelplumbing.com/) — decodes images (WebP/AVIF included) in the main process for near-duplicate hashing; its libvips binaries (LGPL-3.0) ship unpacked from the asar with their license
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

Pushing a `v*` tag (plain `vX.Y.Z`, never a `-beta` suffix) triggers
`.github/workflows/release.yml`, which builds Windows/macOS/Linux installers
into a draft GitHub Release. Publishing it as a pre-release makes it reach the
beta channel; promoting it to "Latest" makes it reach stable. The app checks that same repo for
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

## License

PiCollection is released under the [MIT License](LICENSE).

### Third-party licenses

- **Bundled with the app:** every open-source package it ships with is listed,
  with its full license text, in `resources/third-party-notices.txt`,
  generated before each `dev`/`build` by
  `scripts/generate-third-party-notices.mjs` and opened in the app from
  Settings > Advanced > Open-source licenses. Electron's and Chromium's own
  licenses (`LICENSE.electron.txt`, `LICENSES.chromium.html`) ship next to the
  executable.
- **libvips** (image decoding, bundled with [sharp](https://sharp.pixelplumbing.com/))
  is LGPL-3.0-or-later. It is loaded as a separate library from
  `resources/app.asar.unpacked`, so it can be replaced, and its source is
  available at <https://github.com/libvips/libvips>.
- **Downloaded on request, not bundled** (local AI tagging): a standalone
  Python from [python-build-standalone](https://github.com/astral-sh/python-build-standalone)
  (Python Software Foundation License), the onnxruntime (MIT), NumPy
  (BSD-3-Clause) and Pillow (MIT-CMU) wheels from PyPI, and the
  [SmilingWolf/wd-vit-tagger-v3](https://huggingface.co/SmilingWolf/wd-vit-tagger-v3)
  model (Apache-2.0).
- Online lookups (SauceNAO, Danbooru) use those services under their own
  terms of use; nothing from them is bundled.
