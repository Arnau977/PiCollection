---
name: contrast-check
description: Use in PiCollection whenever choosing, changing or reviewing a text, icon or background color in the renderer (CSS color/background, a token from base.css, a hover/active/disabled state) - computes WCAG 2.x contrast straight from the base.css tokens, the same math as Adobe's Color Contrast Analyzer.
---

# Contrast check

Never assume a color passes because it "looks fine" on a dark background.
Check every text/icon/background pair you introduce or change, including
hover, active, selected and disabled states.

## Run it

```bash
node .claude/skills/contrast-check/contrast.mjs                         # common token pairs
node .claude/skills/contrast-check/contrast.mjs accent-fg:surface-hover # specific pairs
node .claude/skills/contrast-check/contrast.mjs text:#1e1f26 "#ffffff:accent"
```

- Each side is a token name (`text-muted`, `--color-surface`, `accent-fg`) or
  a literal `#hex` / `rgb()` / `rgba()`.
- Translucent colors are composited over the background, and a translucent
  background over `--color-background`, as the browser would render them.
  If the real background under a translucent one is not the page background
  (e.g. `accent-soft` on a sidebar), pass that pair explicitly too.
- The same relative-luminance math as the [Adobe Color Contrast Analyzer](https://color.adobe.com/es/create/color-contrast-analyzer).
  Use the site for a manual double check or for colors outside base.css.

## Thresholds (WCAG AA)

| Content | Minimum |
|---|---|
| Normal text (most UI text, including 0.85rem labels) | 4.5:1 |
| Large text (≥18.66px bold or ≥24px regular) | 3:1 |
| Icons, focus rings, borders that carry meaning | 3:1 |

## Known facts (re-verify with the script if base.css changes)

- `--accent` fails as text/icon color (~2.6-2.8:1). Use it as a button
  background with `--accent-text`, and use `--accent-fg` for accent-colored
  text/icons.
- `--accent-fg` passes on `background`/`surface`, but **not** on
  `surface-hover` or `surface-2` (~4.2-4.4:1). On those, switch hover text to
  `--color-text` instead of keeping it accent-colored.
- `--color-text-faint` is for non-essential decoration only (~3.4:1), never
  for readable text.

## Report

State the ratio of every pair you checked in the PR's design-council notes
(accessibility judge), e.g. "`accent-fg` on `surface` 4.72:1".
