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

1. **Add new media > From folder**, then select files and/or whole folders
   as in Windows Explorer: a click selects only that tile, **Ctrl+click**
   adds or removes one, **Shift+click** selects a range (**Ctrl+Shift+click**
   adds it), and dragging from a gap, below the tiles or the page margins
   draws a rectangle that selects what it covers (**Ctrl+drag** flips them
   instead). A click on empty space or **Esc** clears the selection and
   **Ctrl+A** selects everything (all pages). All of this applies to the
   folder you're in: picks in other folders stay selected. Files already in
   your library (*Already added*) and files you discarded
   earlier (*Discarded*) are greyed out and can't be selected. Each folder's
   number counts only the files still left to import; folders with nothing
   left are hidden, and a checkbox next to the path shows them again. The
   button says how many files will actually be imported (**Import N
   files**), whichever folders you picked them in.
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
(on Danbooru, Rule34, Safebooru, Gelbooru, Yande.re, Konachan and Pixiv)
straight into the pending queue.

1. **Settings > Advanced > Browser extension capture**: turn it on and pair
   the extension. The connection is local to your computer only; nothing
   listens until you turn this on.
2. While it's on, closing the window keeps PiCollection running in the system
   tray so captures keep working.

A capture always lands in the [pending queue](pending-and-discarded.md), to
review there. It links the artist only when the site credits exactly one you
already have, and never creates anything. Everything the site listed is kept,
including its rating, and offered in the [suggestions
panel](tagging.md#from-the-source-site) when you tag the media.

**On Pixiv**: right-clicking a page of a multi-page post saves that page, and
the popup offers **Save all N** to take every page (each becomes its own
pending item). Tags come in English when Pixiv has a translation. Log in to
Pixiv to capture age-restricted works. Pixiv animations (ugoira) can't be
captured yet.

---
← [Getting started](getting-started.md) · [Guide index](README.md) · Next: [Tagging and suggestions](tagging.md) →
