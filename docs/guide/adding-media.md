# Adding media

There are three ways to bring media into PiCollection. None of them moves or
copies your files: the app records where each file already is.

## One file at a time

**Add new media > Single file**: choose a file, fill in what you know (artist,
tags, characters, series, SFW/NSFW, AI-generated, source URL) and press
**Save**. The [suggestions panel](tagging.md#suggestions) next to the form can
fill most of it for you.

Before saving, the app checks for copies already in your library (see
[Duplicates](duplicates.md)): an exact copy can't be added twice, and a
visually similar one shows a warning.

## Batch import from a folder

Needs a [source folder](getting-started.md#pick-a-source-folder-recommended).

1. **Add new media > From folder**, then select files and/or whole folders.
   Files already in your library are left out automatically.
2. The files open one by one in the edit form, **File N of M** at the top.
   They come folder by folder, oldest first, so pictures you saved together
   stay together.
3. For each file:
   - **Save** stores it and stays on it (you can keep editing);
   - **Next** / **Previous** move through the queue (`Alt+→` / `Alt+←`);
     going back to a file you already saved reopens it for editing;
   - **Send to pending** adds it untagged to the [pending
     queue](pending-and-discarded.md) and moves on;
   - **Delete** takes it out of the queue and lists it under
     [Metadata > Discarded](pending-and-discarded.md#discarded-files); the
     file stays on disk.
4. **Send the remaining N to Pending** (next to *File N of M*) sends every
   file you haven't saved yet to the pending queue in one go, after asking.
   Closing the queue with files left offers the same.

Files you discarded earlier are skipped the next time you import their
folder, and a message says how many.

## Capturing from the browser

The **PiCollection Capture** browser extension saves the post you're viewing
(currently on Danbooru and Rule34) straight into the pending queue.

1. **Settings > Advanced > Browser extension capture**: turn it on and pair
   the extension. The connection is local to your computer only; nothing
   listens until you turn this on.
2. While it's on, closing the window keeps PiCollection running in the system
   tray so captures keep working.

A capture starts as NSFW (blurred), links the artist only when the site
credits exactly one you already have, and never creates anything. Everything
the site listed is kept, and offered in the [suggestions
panel](tagging.md#from-the-source-site) when you tag the media.

---
← [Getting started](getting-started.md) · [Guide index](README.md) · Next: [Tagging and suggestions](tagging.md) →
