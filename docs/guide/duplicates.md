# Duplicates

PiCollection watches for copies of the same picture, so the library doesn't
fill up with repeats.

## Exact copies

When you add a file, the app compares it with your library by path and by
content. The same file, even from another folder or with another name, can't
be added twice: the form says where it already is.

## Similar copies

A picture that *looks* the same but isn't byte-for-byte identical (a
recompressed or resized copy, or the same picture saved as PNG and as WebP)
shows a non-blocking warning: **This looks similar to media already in the
app**, with each match's file name and how different it is (out of 64).

It compares a fingerprint of the picture's content plus its proportions, so
two unrelated pictures that only share a plain white background don't match.
Similar items are listed:

- in the add form, for the file you're adding;
- in the edit form, including other pending items, so duplicates within one
  import show up too;
- on a media page, under **Similar media**.

A GIF made from a video with [Video to GIF](viewing-media.md#video-to-gif)
and its video always list each other there too.

## Comparing side by side

Hover a similar item to see the whole picture. Click it (or the compare
button on a similar thumbnail on the media page) to open a full-size
comparison:

- both pictures are lined up in the same frame, with a divider you drag
  across them to reveal one or the other;
- each side is labelled (in library, pending, being added) with its
  format (PNG, JPG...), resolution and file size, so a heavier,
  better-quality copy stands out;
- zoom works on both at once: mouse wheel, double-click, `+` / `-` / `0`;
  zoomed in, dragging pans and the divider moves by its handle.
- click anywhere outside the pictures (or press `Esc`) to close it; a
  drag that merely ends outside them doesn't.

## Replacing a copy

**Replace with this file** on a similar item keeps the file you're looking at
and gets rid of the other copy, without losing its tagging. After asking:

- that media keeps its artist, tags, characters, series and date, gains
  whatever the current form has, and now points to the current file;
- its old file goes to [Metadata > Discarded](pending-and-discarded.md#discarded-files)
  as "replaced";
- the batch import or pending queue moves on to the next item.

---
← [Pending and discarded](pending-and-discarded.md) · [Guide index](README.md) · Next: [Gallery and search](gallery-and-search.md) →
