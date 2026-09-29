# Patterns found in this project

Decisions already made in PiCollection, with where they live. Reuse these
before inventing anything. Everything here comes from this codebase and its
history; ideas from outside go in `patterns-external.md`.

Entry format: **Pattern** - when to use / when not - where (file) - origin.

## Layout

- **Page-owned scroll region instead of `position: sticky`.** The page is
  bounded to the viewport, and only an inner `*-scroll-region` scrolls, so
  action bars, pagination and errors never scroll out of view. Sticky was
  rejected because translucent sticky elements let content show through.
  Where: `.gallery-page` / `.manage-page` / `.add-media-page` /
  `MediaPage.css`, rationale in `src/renderer/src/pages/Manage/ManagePage.css`.
- **Fixed top action bar in the edit form.** It stays in the same spot
  whatever the item's tag count, so buttons don't jump between queue items.
  Where: `src/renderer/src/pages/Media/MediaForm/MediaFormTopActions.tsx`.
- **Suggestions rail: side column on wide screens, above the fields and
  collapsed below 900px.** Where:
  `src/renderer/src/pages/Media/MediaForm/SuggestionsRail.tsx`.

## Actions

- **Group buttons by intent, separated by `.action-divider`.** The only
  discarding action (Cancel/Close) stands alone; Previous/Next stay paired;
  the primary action sits last. Where: `MediaFormTopActions.tsx`,
  `.action-group` / `.action-divider` / `.action-bar-spacer` in
  `src/renderer/src/assets/main.css`.
- **Place an action with what it acts on.** Per-item actions go in the top
  bar; whole-batch actions go next to the batch context (e.g. "Send the
  remaining N to Pending" beside "File N of M"). Where:
  `src/renderer/src/pages/Media/MediaForm/MediaFormFileGroup.tsx` (#92).
- **Primary actions save first.** A button that ends the task ("Save & mark
  resolved") persists the form before moving on, and stays put with the
  error shown if saving fails. Where: `MediaForm.tsx` `saveForm()` (#90).
- **An action that's temporarily unavailable stays visible, is marked
  `aria-disabled` (not `disabled`) and explains why in a tooltip** that also
  opens on keyboard focus and says when it comes back. `.btn[aria-disabled]`
  in `main.css` gives it the disabled look. Where:
  `SauceNaoSuggestionsPanel.tsx` (SauceNAO daily limit).
- **A button whose label changes while busy ("Save" -> "Saving...") keeps
  its width** by reserving every label with `StableLabel`, so the rest of
  the action bar doesn't twitch. Where:
  `src/renderer/src/components/StableLabel/StableLabel.tsx`,
  `MediaFormTopActions.tsx`.
- **Confirm before bulk or destructive actions** with the shared dialog
  (`useConfirm`); name the count in the message and on the button. Where:
  `src/renderer/src/components/ConfirmDialog/ConfirmDialogContext.tsx`.
- **Block the UI during bulk async work**: a full-screen busy overlay with a
  spinner, plus a ref guard against double clicks. It was added after
  re-entrancy created hundreds of duplicate rows. Where:
  `src/renderer/src/pages/Media/ImportQueue/ImportQueue.tsx`.

## Suggestions and metadata

- **Suggestions never apply silently unless they match something already in
  the library.** Existing matches are applied; everything else becomes a
  "create" chip (`.sauce-add-chip`) that does nothing until clicked. That
  goes for SauceNAO, WD14 and source-site tags. A suggestion only fills an
  empty field, and offers a one-click replacement otherwise. Where:
  `SauceNaoSuggestionsPanel.tsx`, `Wd14SuggestionsPanel.tsx` (#83, #88).
- **Extension captures apply nothing but a sole credited artist.** Which
  of a parent/child series pair, a base character and its form, or the
  site's rating the user wants can't be told from code, so the source panel
  offers everything: library matches as "add" chips first, unknown names as
  "create" chips marked "· new" (muted `.suggestion-form-of`), an "Add the N
  already in your library" button (artists excluded) and the site's
  rating/AI flag as hint rows. Chips disappear once the form has them.
  Where: `SourceSuggestionsPanel.tsx`, `useSourceSuggestions.ts`.
- **A suggested form/costume is a child character**: its chip reads
  "Pyra (Pro Swimmer) · form of Pyra" (muted `.suggestion-form-of`); the
  base character is applied right away if it exists, and accepting the chip
  creates the form under it and swaps it in. Where:
  `src/renderer/src/hooks/resolveCharacterCandidates.ts`,
  `CharacterFormOfHint.tsx`.
- **Category colors per metadata type**: `--color-artist` /
  `--color-tag` / `--color-character` / `--color-series`, shown as the
  `.field-accent-*` left bar on form fields. Where: `main.css`.
- **A count is a drill-down.** A media count opens the gallery filtered to
  that entity, keeping the SFW default. Zero stays plain text. Where:
  `src/renderer/src/components/EntityCountButton/EntityCountButton.tsx` (#84).
- **Non-blocking "looks similar" lists** with hover previews and the
  "N/64 difference". Where:
  `src/renderer/src/pages/Media/MediaForm/SimilarMediaWarning.tsx` (#91).
- **Compare two images at full size with a drag divider** (`MediaCompare`):
  both fitted to the same box so identical pictures line up, an invisible
  native range input over the stage for drag/click/keys, and each side's
  resolution. Images/GIFs only. Where:
  `src/renderer/src/components/MediaCompare/MediaCompare.tsx`, opened from
  `SimilarMediaWarning.tsx`.
- **Previews meant for telling images apart are letterboxed, never
  cropped** (`object-fit: contain`). Where: `MediaHoverPreview.css`.

## Media

- **Lightbox only for images/GIFs**, never over a playing video (that
  started a second playback). Where: `MediaFormFileGroup.tsx`.
- **Zoom in the Lightbox**: wheel toward the cursor, drag to pan
  (limited so the image always covers its box), double-click toggles
  fit/2x, `+`/`-`/`0`, and -/%/+ buttons in the action pill. A pan that
  ends over the backdrop must not close it. Images/GIFs only. Where:
  `src/renderer/src/components/Lightbox/useZoomPan.ts`.
- **Video frame fallback**: when the OS can't produce a thumbnail (e.g.
  cloud-synced folders), capture a frame with a `<video>` element and cache
  it. Where: `src/renderer/src/components/MediaThumb/captureVideoFrame.ts`
  (#89).

## Shared components to reach for first

`ConfirmDialog` (via `useConfirm`), `Toast`, `EmptyState`, `Pagination`,
`SettingsRow`, `InfoTooltip`, `TagWikiInfo`, `MediaHoverPreview`,
`MediaFileActions`, `EntityCountButton`, `EntityThumbnail`, `Autocomplete`,
`ManageSortControl`, `FilterBar`, `Lightbox`. All live in
`src/renderer/src/components/`.

# Anti-patterns learned here

Each one cost a bug or a redo in this repo. Check the proposal against all
of them.

- **A primary action that drops unsaved input.** "Mark resolved" cleared
  the pending flag without saving the form, and 112 media lost their tags.
  A test even asserted it. Any action that leaves the view must save first
  or ask (#90).
- **A useful bulk action hidden in an exit dialog.** "Add remaining to
  Pending" only appeared after pressing Close, so the user thought it didn't
  exist (#92).
- **Accent-colored text on hover/raised surfaces.** `--accent-fg` on
  `--color-surface-hover` is 4.22:1 and fails AA. Check hover states with
  the contrast-check skill (fixed in #95).
- **`position: sticky` over translucent layers.** Content bleeds through;
  use a scroll region instead (see ManagePage.css).
- **Unguarded async buttons.** Double clicks during a bulk create produced
  hundreds of duplicate rows; disable the trigger and use a ref guard.
- **Showing a third-party API's message verbatim.** SauceNAO's
  `header.message` is HTML for its website, and the panel printed the raw
  `<strong>`/`<br />` tags. Map known errors to our own message; strip
  tags from anything passed through.
- **Trusting the OS for video thumbnails.** Windows refuses them in
  cloud-synced folders; always keep the in-app frame fallback (#89).
