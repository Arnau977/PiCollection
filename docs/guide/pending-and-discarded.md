# Pending and discarded

## The pending queue

Pending is a waiting room for media you've added but not tagged yet. Items
get there from a [batch import](adding-media.md#batch-import-from-a-folder)
(**Send to pending**, or all the remaining files at once), or from a
[browser capture](adding-media.md#capturing-from-the-browser).

Pending media stays out of the gallery, Home and the Metadata counts until
you finish it, so half-tagged items never clutter your library. Duplicate
checks and backups do include it.

**Pending** in the header opens the oldest item in the edit form, with **File
N of M** and **Previous** / **Next** (`Alt+←` / `Alt+→`) to move through the
queue. For each item:

- **Save** (`Ctrl+S`) stores your changes and stays on it;
- **Save & mark resolved** (`Ctrl+Shift+S`) saves and moves it into the
  library: it counts as added from that moment, and if it has exactly one
  series, its characters get linked to that series;
- **Delete** removes it from the app (the file stays on disk, see below).

## Discarded files

Deleting media never deletes its file. Whether you delete from the gallery,
the pending queue or a batch import, the file stays where it is and is listed
under **Metadata > Discarded**, with its folder, why it left (deleted, or
replaced by a [better copy](duplicates.md#replacing-a-copy)) and when.

From there, for each file:

- **Move to Recycle Bin** puts the file in your system's Recycle Bin
  (recoverable from there);
- **Keep file** leaves it on disk and just removes it from the list.

**Move all N to the Recycle Bin** does the same for the whole list, after
asking. If a file can't be moved (e.g. it's open in another program), it
stays listed and you're told how many failed.

Discarded files are skipped the next time you batch-import their folder.
Adding the same file again (e.g. with *Single file*) takes it off the list.

---
← [Tagging and suggestions](tagging.md) · [Guide index](README.md) · Next: [Duplicates](duplicates.md) →
