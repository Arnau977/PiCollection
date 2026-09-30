# Settings and backups

**Settings** has four tabs.

## General

- **Language**: English or Spanish.
- **Start with Windows** (installed app on Windows/macOS): starts PiCollection
  hidden in the system tray when you sign in.
- **Blur NSFW thumbnails**: the default for the gallery's NSFW blur (see
  [Gallery and search](gallery-and-search.md#nsfw)).
- **Hide names**: hides each media's name under its thumbnail.

## Filters

The gallery's default filters (SFW / NSFW, type) and sorting, used whenever
you open the gallery fresh.

## Data

### Backup & Restore

- **Export...** saves everything (library, tags, settings and gallery
  preferences) into a single `.zip`.
- **Import...** restores such a file on any install, replacing all current
  data (it asks first); **Restart now** finishes it.

Your media files are never part of a backup: only the library that points to
them.

### Automatic backups

Optionally saves a copy of the database and settings **Daily**, **Weekly** or
**Monthly**, to a folder you choose (a synced or external drive is a good
idea), keeping the last 5 to 30 copies. It runs while the app is open or in
the tray, catches up after time off, and skips a copy when nothing changed.
**Back up now** makes one immediately. If a run fails, the Data tab says so.
Restore one with the same **Import...**; gallery preferences are only
included in manual exports.

### Missing files

If you moved or renamed folders outside the app, **Check for missing files**
finds media whose file is no longer at its saved place. To fix a moved
folder, choose the **Old folder** and the new one, and **Relink** updates
every file under it in one step, without copying anything. Single files can
be relinked one by one.

### Source folder

The folder your media lives under (see [Getting
started](getting-started.md#pick-a-source-folder-recommended)). Choosing or
changing it shows which files it affects before you **Apply**.

## Advanced

- **Updates**: current version, **Stable** or **Beta** channel, and checking
  for / installing updates.
- **SauceNAO API key**: needed for [SauceNAO suggestions](tagging.md#saucenao).
  Register a free account at saucenao.com and paste your key.
- **Danbooru account** (optional): makes tag lookups use your own account,
  which Danbooru's bot protection challenges less, and enables tag
  autocomplete and exact character lookups.
- **Browser extension capture**: pairs the [capture
  extension](adding-media.md#capturing-from-the-browser). Off by default.
- **Debug logging**: records errors to a local log file (up to about 10 MB)
  to help diagnose a bug; off by default and never sent anywhere.
  **Open folder** shows the log.
- **Local AI tagging**: downloads the [local tagger](tagging.md#local-ai)
  once, and sets how strict its NSFW suggestion is.
- **Open-source licenses**: PiCollection is MIT-licensed; **View licenses**
  lists the open-source components it includes.

---
← [Viewing media](viewing-media.md) · [Guide index](README.md) · Next: [Keyboard shortcuts](keyboard-shortcuts.md) →
