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
- **What it does**: see [Features](#features) below for the full list -
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

- **Tagging** — attach Artists, Tags, Characters and Series to each item, with
  Characters/Series linked many-to-many. On the Metadata page, clicking an
  entry's media count opens the gallery filtered to it.
- **Pending queue** — media you add now and tag later (single files, the
  rest of a batch import in one click, or browser-extension captures).
  Pending media stays out of the gallery, Metadata counts and Home stats
  until you press "Save & mark resolved". It counts as added from that
  moment, and its characters get linked to its series then.
- **Batch import** — pick files and folders from your source folder and
  step through them one by one (Previous/Next, Save, Send to pending), or
  send all the remaining ones to Pending at once. Files come folder by
  folder, oldest-modified first, so pictures saved together stay together.
  Going back to a file you already saved reopens it for editing.
  Delete takes a file out of the queue; files you discarded earlier are
  skipped (with a count) the next time you import their folder.
- **Discarded files** — deleting media (from the gallery, the pending queue
  or a batch import) never touches the file on disk: it's listed under
  Manage > Discarded with where it lives, why and when. From there each file
  can go to the Recycle Bin, one by one or all at once, or be kept where it
  is (it just leaves the list). Adding the same file again takes it off the
  list.
- **Video to GIF** — "Make GIF" on a video's page turns a clip of up to 10
  seconds into a GIF, entirely on your device. Presets fit Discord (≤ 10 MB)
  or X/Twitter (≤ 15 MB), re-encoding smaller until the file fits, or keep
  the best quality for the gallery; width and frame rate can also be set by
  hand. The GIF is saved next to the video and added to the library with the
  video's artist, tags, characters, series and rating, and the two always
  list each other under "Similar media" ("Source video" / "GIF from it").
- **Full-size viewer** — clicking an image or GIF (in its detail page or the
  edit form) opens it full screen, with zoom: mouse wheel toward the cursor,
  drag to pan, double-click to toggle, `+`/`-`/`0`, or the zoom buttons.
- **Gallery search** — a single text field that suggests tags/characters/
  series/artists and supports `AND` (space), `OR`, `-exclude` and
  `(parentheses)` for grouping, e.g. `(Ishtar OR Ereshkigal) -Fujimaru`.
  Its suggestions, like every tag/character/series/artist picker, forgive
  typos, accents, underscores, parentheses and word order: `pyra xenoblade`
  or `pyar` both find "Pyra (Xenoblade)", closest match first.
- **Hierarchy-aware filters** — filtering by a character also finds its
  forms (Mythra finds Mythra (Pro Swimmer)), and a series its subseries.
  The crosshair on a selected chip switches that one to "only this one":
  media tagged with it directly, whether or not the form is there too.
  The box at the start of a tag, character or series chip flips it between
  included (check) and excluded (cross), e.g. Rex but not Pyra; excluding a
  character also leaves out its forms unless the crosshair is on.
- **Fast thumbnails** — grid and list views load a small cached preview
  instead of the original file; GIFs and videos only animate on hover.
- **NSFW handling** — mark media as NSFW, optionally blur it in listings, and
  reveal on click. Blurring can be switched from the gallery toolbar or with
  `Ctrl+B` on any page.
- **Keyboard shortcuts** — `E` edits the open media and `Esc` leaves the
  form (in a field, the first `Esc` just leaves the field; leaving with
  unsaved changes, by `Esc` or Cancel, asks before discarding them), `Ctrl+S` saves, `Ctrl+Shift+S` saves and marks
  a pending media resolved, `Ctrl+Shift+A` runs the local AI tagger, and
  `Alt+←`/`Alt+→` move through a batch import or the pending queue. Each button's tooltip
  shows its shortcut.
- **Home dashboard** — recent additions plus a quick stats summary of your
  most-tagged artists/tags/characters/series.
- **Window state** — remembers the app window's size and position between
  launches.
- **Start with Windows** — optional; starts hidden in the system tray when
  you sign in (installed builds on Windows/macOS).
- **Auto-update** — checks GitHub Releases for new versions, with an opt-in
  beta channel; see [`docs/auto-update.md`](docs/auto-update.md).
- **Suggestions panel** — beside the add/edit media form, one tab per
  source (the capture's site, SauceNAO, Local AI), each showing how many
  suggestions are waiting. Captures open on their site's tab; otherwise it
  reopens on the lookup you used last.
- **Tag suggestions** — on the add/edit media form, "Suggest tags" sends a
  thumbnail to [SauceNAO](https://saucenao.com) to find the source artwork
  and pre-fill its known artist/characters/series/tags. Works on images,
  GIFs and videos (via the same thumbnail the gallery uses, or a frame
  captured by the app when Windows can't thumbnail a video, e.g. in a
  cloud-synced folder). Suggestions that match an existing character/series by
  name or alias are applied silently instead of being offered again. The
  matched post's URL fills an empty "Source URL" field; if you already typed
  a different one, it's offered as a one-click replacement instead. When
  the match includes a known artist social profile (Pixiv, Twitter/X), it's
  linked automatically if you create that artist from the suggestion.
  Character tags like `pyra_(pro_swimmer)_(xenoblade)` are read the booru
  way: the last parenthesis is the series (offered only if it names one you
  already have), the earlier ones are a form or costume, suggested as
  "Pyra (Pro Swimmer)", a child of "Pyra", so searching for Pyra still finds it.
  With a Danbooru account in Settings, the app asks Danbooru instead (by tag
  name only, cached for 30 days): the exact base character, and the most
  specific series (Xenoblade Chronicles 2 rather than the whole franchise).
  Requires a free SauceNAO API key set in Settings — SauceNAO no longer
  allows anonymous API access at all, so the suggestions button doesn't
  appear at all until a key is configured. Once SauceNAO's daily search
  limit is reached, the button turns off for an hour and its tooltip says
  when to try again. This is the only feature that
  sends any of your media off your machine, and only on that explicit
  button press.
- **Local AI tagging** — "Suggest tags locally" runs a WD14 tagger entirely
  on your device (no upload): tags, characters, series and a SFW/NSFW
  hint. The runtime and model are downloaded once, from Settings.
- **AI-generated hint** — the edit form reads an image's own metadata
  (on your device) for traces generators leave: Stable Diffusion WebUI,
  ComfyUI, InvokeAI and NovelAI parameters, or the "fully AI-generated"
  mark of Content Credentials/IPTC. When it finds one it offers "Mark as
  AI"; most sites strip this metadata, so finding nothing proves nothing.
  Captures from boorus also suggest it when the post has the
  `ai-generated` tag.
- **Browser extension captures** — the PiCollection Capture extension
  (paired from Settings, over a local-only connection) saves the post
  you're viewing straight to the pending queue. With it enabled, closing
  the window keeps PiCollection running in the system tray. A capture only
  links the artist, when the site credits exactly one you already have; it
  starts as NSFW (blurred) and never creates anything. Everything the site
  had is kept as source info: when you tag the media, the suggestions panel's
  site tab ("danbooru") offers the tags, characters and series you already have
  (one by one or all at once), the ones you don't (marked "new", created on
  click), and the site's rating and AI tag. Nothing from the site gets
  added unless you pick it.
- **File location** — the edit form shows the file's name and folder, with
  copy and "open in file explorer" actions.
- **Backup & Restore** — export the whole library (database, tags, settings,
  gallery preferences) to a single `.zip` from Settings, and restore it as a
  full replace on any install. A separate "Missing files" tool detects media
  whose files moved and bulk-relinks them to a new folder in one step,
  without ever needing to re-copy the files themselves.
- **Automatic backups** — optionally back up the database and settings daily,
  weekly or monthly to a folder of your choice (e.g. a synced or external
  drive), keeping the last 5–30 copies. Runs while the app is open or in the
  tray, catches up after time off, skips unchanged libraries, and flags a
  failed run on the Settings "Data" tab. Restore with the same "Import
  backup"; gallery preferences are only in manual exports.
- **Duplicate detection** — adding media checks the new file's path and
  content against what's already in the library: an exact match (same file,
  even from a different path) blocks the add, and a visually similar file
  (e.g. a recompressed or resized copy, or the same picture saved as PNG and
  WebP) shows a non-blocking warning. Similarity compares a perceptual hash
  of the picture and its proportions, so unrelated pictures that merely
  share a plain background don't match. The
  edit form and the detail page list visually similar media too; while
  editing, that includes other pending items, so duplicates inside an
  import batch show up. "Replace with this file" on a similar item makes the
  current file take its place: that media keeps its tags, characters, series
  and date, gains what the form has, and its old file goes to Discarded.
  In the add/edit form, hovering a similar item shows
  the whole picture, and clicking it opens a full-size comparison with a
  divider you drag across both images (images and GIFs); on the detail
  page, the compare button on a similar thumbnail does the same. The
  comparison labels each side (in library, pending, being added) with its
  resolution and file size - so a heavier copy of the same picture stands
  out - keeps
  the divider over the pictures, and zooms both at once (wheel,
  double-click, `+`/`-`/`0`); zoomed, dragging pans and the divider moves
  by its handle.

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
