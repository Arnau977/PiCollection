# Gallery and search

The **Gallery** shows your whole library (pending items aside) as a grid of
thumbnails, with the search bar and filters on top. Thumbnails are small
cached previews, so large collections scroll smoothly; GIFs and videos only
play while you hover them. **Grid size** and page size are in the toolbar.

## Search

The search bar matches names of tags, characters, series, artists and the
media itself, and suggests them as you type (forgiving typos, like every
picker). It understands:

| Write | Means |
|---|---|
| `pyra mythra` | both (a space is AND) |
| `pyra OR mythra` | either |
| `-swimsuit` | not this |
| `(ishtar OR ereshkigal) -fujimaru` | parentheses group |

Picking a **tag, character or series from the suggestions** adds it as a
filter instead of text. For characters and series that matters: the filter
also finds their forms and subseries (see below), plain text doesn't.

## Filters

Below the search bar:

- **Artist**, **Tags**, **Characters**, **Series**. Inside one box every
  item must match (AND). **Add OR group** starts another box that can match
  instead, e.g. *(Ishtar AND Ereshkigal)* OR *(Rin AND Shirou)*.
- **Include or exclude**: the box at the start of a tag, character or series
  chip flips it between ✓ (must have it) and ✗ (must *not* have it), e.g.
  Rex but not Pyra. No chip means not filtered by it.
- **Forms and subseries**: filtering by a character also finds its forms
  (Mythra finds "Mythra (Pro Swimmer)"), and a series its subseries. The
  crosshair on a chip switches it to **only this one**: media tagged with it
  directly. Excluding a character also leaves out its forms, unless the
  crosshair is on.
- **No character assigned** / **No series assigned** find media still
  missing them.
- **More filters**: SFW / NSFW, AI-generated (all, only, exclude), and type
  (image, video, GIF).
- **Sort by** date or name, ascending or descending.

When filters hide part of your library, a notice says so, with **Clear
filters**. Default filters and sorting for the gallery are set in **Settings
> Filters**.

## NSFW

Mark media as NSFW in its edit form (for a capture, the site's rating is
offered as a suggestion). With **Blur
NSFW** on, their thumbnails stay blurred until you open them. Toggle it from
the gallery toolbar, with `Ctrl+B` on any page, or by default in **Settings >
General**. **Hide names** there hides the name under each thumbnail.

## Working with several items

Select thumbnails with their checkbox (or **Select all on this page**), then:

- **Edit metadata**: add or remove tags, characters and series, and set SFW
  or NSFW, on all of them at once;
- **Delete selected**: removes them from the app; the files stay on disk and
  go to [Metadata > Discarded](pending-and-discarded.md#discarded-files).

---
← [Duplicates](duplicates.md) · [Guide index](README.md) · Next: [Viewing media](viewing-media.md) →
