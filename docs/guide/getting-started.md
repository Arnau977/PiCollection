# Getting started

PiCollection is a desktop gallery for the images, GIFs and videos you already
have on disk. It never moves, copies or uploads your files: it only keeps an
index of them (with your tags) in a local database, so you can browse and
filter a large personal collection quickly.

## Install

1. Download the installer for your system (Windows, macOS or Linux) from the
   [Releases page](https://github.com/Arnau977/PiCollection/releases).
2. Run it. On Windows you can pick the install folder; a desktop shortcut is
   created.

From then on the app checks for new versions itself: **Settings > Advanced >
Updates** shows the current version and lets you choose the **Stable**
channel (recommended, fully released versions) or **Beta** (earlier access to
new features, possibly less stable). Updates are only downloaded when you say
so.

## Pick a source folder (recommended)

**Settings > Data > Source folder** lets you choose the one folder your media
lives under (for example `D:\Pictures\Collection`). It's optional, but it
unlocks two things:

- **Batch import**: *Add new media > From folder* browses that folder so you
  can import whole subfolders at once (see [Adding media](adding-media.md)).
- **Moving your collection**: files inside it are stored relative to it, so
  if you move the whole folder to another drive you only change this setting,
  and nothing breaks.

## A tour of the app

The header has five pages:

- **Home**: your latest additions and a quick summary of your most-tagged
  artists, tags, characters and series.
- **Gallery**: the whole library as a grid or list, with search and filters
  (see [Gallery and search](gallery-and-search.md)).
- **Pending**: media you added but haven't tagged yet, one item at a time
  (see [Pending and discarded](pending-and-discarded.md)).
- **Metadata**: your artists, tags, characters and series, with how many media
  use each (click a count to see them in the gallery), plus the **Discarded**
  tab.
- **Settings**: see [Settings and backups](settings-and-backups.md).

The app remembers its window size and position between launches.

## What stays on your machine

Your media files never move and are never uploaded. Browsing, tagging,
searching and backups all happen locally. The app only goes online for:

- **SauceNAO tag suggestions**: the one feature that sends any of your
  content (a small thumbnail), and only when you press its button;
- checking GitHub for app updates;
- the one-time download of the local AI tagger, when you enable it;
- Danbooru lookups by tag *name* (never your images): tag descriptions, tag
  autocomplete if you add a Danbooru account, and details of a post SauceNAO
  matched.

---
[Guide index](README.md) · Next: [Adding media](adding-media.md) →
