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
- **A failed save shows right under that fixed bar, naming the field.** A
  danger-soft banner (`role="alert"`) between the bar and the scroll region,
  never at the bottom of the form; a field error (main-process `AppError`
  code, mapped in `mediaFormError.ts`) says which field and offers "Go to
  <field>", and the field's input gets a danger border (`invalid` on
  `Autocomplete`, aria-invalid). Where: `MediaFormSaveError.tsx`.
- **Suggestions rail: side column on wide screens, above the fields and
  collapsed below 900px**, with one tab per source (the capture's site,
  SauceNAO, Local AI) instead of stacked sections, each tab showing its
  pending count. Captures open on their site's tab; otherwise the lookup
  picked last is remembered (localStorage). Where:
  `src/renderer/src/pages/Media/MediaForm/SuggestionsRail.tsx`,
  `useSuggestionsTab.ts`.
- **Suggested SFW uses `.badge-safe`** (green, `--color-success` on its soft
  fill, 6.79:1) as the counterpart of the accent NSFW badge; the muted
  neutral badge was nearly invisible. Where: `main.css`.
- **Loading placeholders use the shared `media-thumb-shimmer`** (e.g. the
  SauceNAO tag skeleton while Danbooru answers), with a visible
  "Loading..." label in a `role="status"` and no animation under
  reduced motion. Where: `SauceNaoSuggestionsPanel.tsx`.

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
- **Deleting never touches the file; files are cleaned up from Manage >
  Discarded.** Delete (gallery, pending, batch import - same danger button
  slot at the end of the edit form's bar, same confirm) records the file;
  the Discarded tab (plain accent, not a category color) lists it with
  "Keep file" / "Move to Recycle Bin" per row and a bulk "Move all N" behind
  a confirm, one sequential IPC call, all buttons locked while it runs.
  Where: `DiscardedManager.tsx`, `ImportQueue.tsx`.
- **Block the UI during bulk async work**: a full-screen busy overlay with a
  spinner, plus a ref guard against double clicks. It was added after
  re-entrancy created hundreds of duplicate rows. Where:
  `src/renderer/src/pages/Media/ImportQueue/ImportQueue.tsx`.

- **Keyboard shortcuts go through `useShortcut`** (`hooks/useShortcut.ts`,
  keys listed in `SHORTCUTS`): plain keys are skipped while typing, all
  are skipped while a modal is open, and a shortcut presses the real button
  (via a ref) so it inherits its disabled state. Every button with a
  shortcut shows it in its tooltip ("Save (Ctrl+S)") and `aria-keyshortcuts`.
  A plain Esc inside a field only leaves the field.
- **Leaving an edit form with unsaved changes asks first** (Cancel or Esc,
  "Discard changes" as a danger confirm); nothing to lose, no dialog. A
  batch import's Close keeps its own exit dialog instead. Where:
  `MediaFormTopActions.tsx` (`isDirty` from `MediaForm.tsx`).
- **A view setting toggled away from its settings page confirms with a
  toast** when the change isn't otherwise visible (Ctrl+B on a page without
  the gallery toolbar). Gallery view settings are a shared store
  (`useGalleryDefaults`), so every consumer updates at once.

- **A per-chip on/off option is a small round toggle inside the chip**
  (`ChipToggle` in `MultiSelectAutocomplete`), shown only where it
  applies (e.g. the crosshair "only this one, without its forms" on a
  character/series that has children), `aria-pressed`, inverted when on.
  Where: `MultiSelectAutocomplete.tsx`, `FilterBar.tsx`.
- **Include/exclude on a filter chip is a checkbox-like box at its start**
  (`ChipExclusion`): square-check = must have, square-x = must not have
  (the square frame keeps it distinct from the bare remove ×); no chip is
  the third "not filtered" state. Excluded chips get a danger outline and a
  struck-through name, so the state never relies on color alone. Where:
  `MultiSelectAutocomplete.tsx`, `GroupedEntityFilter.tsx`.
- **Autocomplete "Create ..." goes last, pinned to the list's bottom**
  (opaque, separated only when matches sit above it): a typed name is
  usually one that exists, yet a long fuzzy list never hides Create; a
  `scroll-padding-bottom` keeps keyboard focus clear of it. The popover
  opens above when one page of options doesn't fit below - react-aria
  measures the popover (`scrollRef`), not the full ListBox. Where:
  `src/renderer/src/components/Autocomplete/Autocomplete.tsx` + `.css`.

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
- **A hint about a record field sits under that field, and only applies
  itself when the file itself is the source.** The file-metadata AI
  detection turns AI on for new and pending media and says why ("Marked
  as AI: the file's metadata says it was made with X"); for library media,
  or once turned off, it offers "Mark as AI" instead. Right under the
  SFW/AI toggles (`.media-form-ai-hint`, muted text 6.44:1 on surface).
  Guesses (SauceNAO, WD14, source sites) still never apply themselves.
  Where: `MediaFormDetailsFields.tsx`, `MediaForm.tsx`.
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
  "N/64 difference", and a compact "Replace with this file" button at the
  right of each match (not for a video/GIF relation), behind a confirm that
  says what the match keeps and that its file goes to Discarded; it locks
  while the form saves. An exact copy uses the same list (`identical`: an
  alert title, "identical file", Save blocked) so it can still be replaced -
  a bare blocking error left a pending copy impossible to swap. Where:
  `src/renderer/src/pages/Media/MediaForm/SimilarMediaWarning.tsx` (#91).
- **Compare two images at full size with a drag divider** (`MediaCompare`):
  both fitted to the same box so identical pictures line up; the stage
  handles the pointer (continuous, not the range input's 1% steps) and a
  hidden native range input keeps arrows/Home/End; the divider is clamped
  to the images' on-screen span (`dividerBounds.ts`); shared zoom via
  `useZoomPan` + `ZoomControls`, with each image in an unzoomed clipping
  layer so the clip follows the divider; zoomed, drag pans and only the
  divider line moves it (Lightroom). Each side shows its format ("PNG"),
  resolution, file size (read from the protocol's Content-Range, one byte fetched) and a
  solid status pill (library / pending / being added); zoom + close sit
  centered between the two labels.
  A click (no drag) both pressed and released outside the images
  closes it; a drag that only ends out there never does
  (`isOverImage`). Images/GIFs only.
  Where: `src/renderer/src/components/MediaCompare/`, opened from
  `SimilarMediaWarning.tsx` and the detail page's `SimilarMediaPanel.tsx`
  (a compare button revealed on hover/focus).
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
- **Thumbnail badges share the bottom-right corner** (`.media-thumb-badges`):
  AI (named for screen readers, since it isn't visible in the picture),
  then GIF/play; top-left is the selection checkbox. Same dark translucent
  pill, white text 4.74:1 over a white picture. Where: `MediaThumb.tsx`.
- **Batch-import tiles show why a file can't be picked**: green "Already
  added" (`is-cataloged`), neutral dashed "Discarded" (`is-discarded`,
  text on surface-2 13.17:1; the grey filter is on the image only so the
  label keeps its contrast). Folder counts mean "left to import"; folders
  at 0 are hidden behind a "Show N folders with nothing left" checkbox at
  the end of the breadcrumb row and, when shown, reuse the added look and
  open but can't be selected. Where: `FolderBrowser.tsx`.
- **Video frame fallback**: when the OS can't produce a thumbnail (e.g.
  cloud-synced folders), capture a frame with a `<video>` element and cache
  it. Where: `src/renderer/src/components/MediaThumb/captureVideoFrame.ts`
  (#89).

- **A task dialog (e.g. Make GIF) reuses the ConfirmDialog shell**
  (`.confirm-dialog-backdrop` / `.confirm-dialog`), wider and capped to
  the viewport so its actions row never scrolls away; while it works, the
  inputs are locked (`<fieldset disabled>`), Escape/backdrop don't close
  it, a `<progress>` + `role="status"` line shows progress, and Cancel
  becomes Stop. Where: `pages/Media/VideoToGif/VideoToGifDialog.tsx`.

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
- **A filter value with no visible chip.** Chips are drawn from the entity
  lists, so a filter id whose entity was deleted or merged stayed applied
  but showed nothing: the gallery read "No media yet" under "Filters are
  hiding some media" with every field empty. Drop ids that no longer
  resolve (`pruneMissingEntities.ts`), and give a filtered empty result its
  own message. Where: `GalleryPage.tsx`, `Gallery.tsx`.
- **Reserving room for a floating overlay with a fixed padding.** The
  compare view's labels kept `padding-right: 3.5rem` for the close pill;
  once zoom controls joined it, the pill covered the right-hand label.
  Put the controls in the same row (grid/flex) instead of floating them
  over content. Where: `MediaCompare.css`.
