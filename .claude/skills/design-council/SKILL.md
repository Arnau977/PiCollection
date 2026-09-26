---
name: design-council
description: Use in PiCollection for any renderer UI/UX work - designing or redesigning a screen, adding or moving a button/panel/list, changing layout, styles, colors, empty/loading/error states - before deciding the approach. Runs the four-judge design council against the project's own patterns and anti-patterns, researched references and current trends.
---

# Design council

Act as a senior, critical, bold and ultra-specific graphic designer and art
director. No "AI slop", no predictable or cliché solutions.

## 0. Size the effort

- **Small tweak** (a label, one color, a spacing fix): check it against
  `patterns-project.md` and the contrast-check skill, then state the result
  in one line. No full council.
- **Anything bigger** (a new control, a moved action, a new panel or
  screen, a redesign): run steps 1-4.

## 1. Start from what the project already decided

Read `patterns-project.md` in this folder:
- Reuse a listed pattern or shared component before inventing a new one.
- Check the proposal against **every anti-pattern** listed there. Each one
  already cost a bug here.

## 2. Outside references and current trends

Read `patterns-external.md` in this folder:
- If the problem type is already covered there, use it, and check the
  proposal against its recorded **anti-patterns** too.
- If it isn't, research it (desktop-first sources: Fluent 2 / Windows, Apple
  HIG, Nielsen Norman Group), including what those sources warn against,
  and **record** both the patterns and the anti-patterns before deciding.
- **Trend check** - for a new screen or a redesign, or when the recorded
  trends are more than 12 months old: search for current desktop and
  collection-app UI trends, and record the relevant ones with their date.
  Trends are inputs for the judges, not mandates. A trend that fights the
  project's patterns or accessibility loses.

## 3. Run the council

Put the proposal through four judges, each from its own angle, with a
default weight. Adjust the weights when one axis clearly matters more for
this screen, and say so explicitly.

- **UI (30%)** - visual hierarchy, color, typography, consistency with the
  app's visual language (category colors `--color-artist` / `--color-series`
  / `--color-character` / `--color-tag`, the "Archive Cabinet" `--accent`).
- **UX (30%)** - flow, order of actions, what is lost or gained on narrow
  viewports, real user friction, what the user should see or do first.
- **Accessibility (20%)** - contrast (run the **contrast-check** skill on
  every text/icon/background pair, hover/active/disabled included: AA is
  4.5:1 for normal text, 3:1 for large text and icons/UI), visible keyboard
  focus, ARIA roles, click target size, `prefers-reduced-motion`.
- **Desktop app structure (20%)** - what is "native" for an Electron
  file/collection manager versus a transplanted web pattern, and
  consistency with the project's patterns.

Always check:
- It works below 900px (the app's narrow breakpoint).
- It's fully usable with the keyboard.
- Motion respects `prefers-reduced-motion`.
- Nothing critical has to be scrolled to.

Weigh the votes to decide. If two high-weight judges disagree, say so
instead of silently averaging, and explain how it was resolved (which judge
yielded and why).

Output the council as a short table, and reuse it as the PR's
"Design council" section:

| Judge | Vote | Key point |
|---|---|---|
| UI 30% | for / against / conditional | ... |
| UX 30% | ... | ... |
| Accessibility 20% | ... | contrast ratios checked |
| Desktop 20% | ... | ... |
| **Decision** | | which option, and any disagreement resolved |

## 4. Record what was learned

- A new pattern decided here goes into `patterns-project.md`, with its file.
- A bug or redo caused by a design choice goes in as an anti-pattern.
- Researched patterns, anti-patterns and trends go into
  `patterns-external.md`, with source and date.

## Rules that apply to every renderer change

UI/UX and perceived performance are part of the task, not a follow-up:

- **Don't make the user scroll to find something they need right away**
  (an action button, pagination, an error). Bound the page to the viewport
  with its own inner scroll region; don't use `position: sticky` (see
  `patterns-project.md`).
- **Don't show the same information or control twice** on one view without
  a reason (e.g. a count already shown in a button's own label).
- **Reuse existing components, classes and patterns.** Keep spacing,
  empty/error/loading states, button placement and pagination consistent
  across pages.
- **Block inputs during async work**: disable the trigger and close
  controls, and show a spinner or progress. Batch writes go through one
  sequential IPC call, not N concurrent ones.
