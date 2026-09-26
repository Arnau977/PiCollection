---
name: design-council
description: Use in PiCollection for any renderer UI/UX work - designing or redesigning a screen, adding or moving a button/panel/list, changing layout, styles, colors, empty/loading/error states - before deciding the approach. Runs the four-judge design council and applies the repo's layout and consistency rules.
---

# Design council

Act as a senior, critical, bold and ultra-specific graphic designer and art
director. No "AI slop", no predictable or cliché solutions.

## 1. Run the council before deciding

Put the proposal through four judges, each from its own angle, with a
default weight. Adjust the weights when one axis clearly matters more for
this particular screen, and say so explicitly.

- **UI (30%)** - visual hierarchy, color, typography, consistency with the
  app's existing visual language (the metadata category colors
  `--color-artist` / `--color-series` / `--color-character` / `--color-tag`,
  the "Archive Cabinet" `--accent`).
- **UX (30%)** - flow, order of actions, what is lost or gained on narrow
  viewports, real user friction, what the user should see or do first.
- **Accessibility (20%)** - contrast, visible keyboard focus, ARIA roles,
  click target size, `prefers-reduced-motion`. For every text/icon/background
  pair (hover/active/disabled included), run the **contrast-check** skill:
  AA is 4.5:1 for normal text, 3:1 for large text (≥18.66px bold / 24px
  regular) and icons/UI components. Never assume a color passes because it
  looks fine on a dark background.
- **Desktop app structure (20%)** - Electron and file/collection-manager
  apps specifically: what is "native" there versus a web pattern
  transplanted without thought, and consistency with this repo's patterns
  (`*-scroll-region`, sticky vs. scroll-bound - see below).

Weigh the four votes to decide. If two high-weight judges disagree, say so
explicitly instead of silently averaging, and explain how it was resolved
(which judge yielded and why). Summarize the council in the PR ("Design
council" section) with the contrast ratios checked.

## 2. Rules that apply to every renderer change

UI/UX and perceived performance are part of the task, not a follow-up:

- **Don't make the user scroll to find something they need right away**
  (an action button, pagination, an error). Bound the page to the viewport
  with its own inner scroll region instead of letting critical controls
  scroll out of view. See `.gallery-page` / `.manage-page` /
  `.add-media-page` and their `*-scroll-region` for the established approach,
  including why `position: sticky` was rejected in its favor.
- **Don't show the same information or control twice** on one view without
  a reason (e.g. a count already shown in a button's own label).
- **Reuse existing components, classes and patterns** instead of inventing
  new ones for something the app already has a convention for. Keep spacing,
  empty/error/loading states, button placement and pagination consistent
  across pages.
- **Block inputs during async work**: disable the trigger and close
  controls, and show a spinner or progress. Batch writes go through one
  sequential IPC call, not N concurrent ones.
- **Group actions by what they act on**: per-item actions stay together;
  whole-batch or whole-page actions sit with the batch or page context
  (e.g. "Send the remaining N to Pending" next to the queue progress).
