# Gallery and search

The **Gallery** shows your whole library (pending items aside) as a grid of
thumbnails, with the search bar and filters on top. Thumbnails are small
cached previews, so large collections scroll smoothly; GIFs and videos only
play while you hover them. A corner badge marks GIFs, videos and AI-generated
media. **Grid size** and page size are in the toolbar.

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
- **No artist assigned** / **No character assigned** / **No series
  assigned** (the crossed-circle button in each field) find media still
  missing them.
- **More filters**: SFW / NSFW, AI-generated (all, only, exclude), and type
  (image, video, GIF).
- **Sort by** date, name or size on disk, ascending or descending. Sizes are
  read in the background (the first time, the whole library); a file not
  read yet sorts last when going from the heaviest.

When filters hide part of your library, a notice says so, with **Clear
filters**, and an empty result reads "No media matches these filters". A
filter on an artist, tag, character or series you've since deleted or merged
is dropped. Default filters and sorting for the gallery are set in **Settings
> Filters**.

## Filter lists

A filter list is a set of filters with a name, such as "Profile picture" for
"SFW, none of these tags". Any active filters can be saved: click **Save as
list** in the bar under the filters, name it, and take out anything you don't
want to keep with its ×. Once saved, the list shows as a chip in place of the
filters it holds, and what you took out stays on as loose filters, so the
results don't change.

To apply a list, click the empty search box to see your lists, or type part of
its name and pick the one marked **List**. It shows as a chip with a bookmark;
its × takes it off and leaves your other filters alone.

Filters you add on top narrow it further, so "Profile picture" plus a character
shows that character's pictures that pass the list. Several lists can be on at
once, and a picture has to pass them all. If nothing can pass, the gallery is
empty and the chips stay, so you can see why.

Saving while a list is on keeps a link to it, not a copy: when you change the
original list later, the new one follows it. Lists never cover Pending, and the
sort order isn't saved.

To change a list while looking at its results, click the pencil on its chip.
The list opens into normal filters, joined by any you had added beside it, and
the bar says **Editing "name"**. Add, remove or exclude what you like: the
gallery updates as you go, and you can open a picture and come back. **Save
changes** puts it all back into the list; **Cancel** leaves the list as it was
and brings back your earlier filters. Other lists you had on step aside until
you finish. A gallery default the list doesn't set, such as SFW only, stays on
but isn't saved in the list, and the bar says so. Closing the app drops an
unfinished edit.

**Lists**, at the top of the gallery, opens the page where you create, edit and
delete them. Each row sums up what the list holds and can open it in the
gallery, either to use it or to edit it there. A list's name changes on this
page only. A list can include others, except one that would loop back to it. A
list that another one includes can't be deleted; the message names which.

Deleting a tag, character, series or artist takes it out of the lists that use
it, so they match more than before. Those lists say **Lost a filter** on this
page, and a warning replaces the bookmark on the chip and opens this page,
including when the list
that lost it is inside the one you applied. Saving the list clears the warning.

## NSFW

Mark media as NSFW in its edit form (for a capture, the site's rating is
offered as a suggestion). With **Blur
NSFW** on, their thumbnails stay blurred until you open them. Toggle it from
the gallery toolbar, with `Ctrl+B` on any page, or by default in **Settings >
General**. **Hide names** there hides the name under each thumbnail.

## Working with several items

Select thumbnails with their checkbox (or **Select all on this page**). The
selection stays while you open a media and come back; changing the filters or
the order clears it. Then:

- **Edit metadata**: add or remove tags, characters and series, set SFW or
  NSFW, and mark them as AI-generated or not, on all of them at once;
- **Delete selected**: removes them from the app; the files stay on disk and
  go to [Metadata > Discarded](pending-and-discarded.md#discarded-files).

---
← [Duplicates](duplicates.md) · [Guide index](README.md) · Next: [Viewing media](viewing-media.md) →
