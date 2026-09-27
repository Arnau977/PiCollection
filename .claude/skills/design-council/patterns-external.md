# Patterns, anti-patterns and trends researched outside the project

References found on the web, so the same research isn't repeated. What was
decided or learned *in* PiCollection goes in `patterns-project.md`, not
here.

## Rules for this file

- Research only when the council faces a problem type that neither file
  covers yet, or when a trend check is due (see SKILL.md). Record the result
  right away.
- Prefer desktop-native sources, since this is an Electron file/collection
  manager: Microsoft Fluent 2 / Windows app design, Apple Human Interface
  Guidelines, Nielsen Norman Group. Use Material Design only for comparison.
  Treat Dribbble-style showcases as inspiration, not evidence.
- One entry per pattern, specific enough to act on. No generic "best
  practices".
- When researching a pattern, also look for its known **anti-patterns**
  (what the same sources warn against, documented usability failures, dark
  patterns) and record them. They are usually the quickest check against a
  proposal.
- Every entry has a source and the date it was checked. Trends older than
  12 months get re-checked before being relied on.

## Entry format

```markdown
### <Pattern, anti-pattern or trend name>
- Kind: pattern | anti-pattern | trend
- Use when / avoid when: ...          (anti-pattern: why it fails, what to do instead)
- Takeaway for PiCollection: ...
- Source: <title> - <url>
- Checked: YYYY-MM-DD
```

## Patterns

### Explain a disabled button with a tooltip on an aria-disabled control
- Kind: pattern
- Use when / avoid when: an action is unavailable for a reason the user can't see (quota, missing prerequisite). Keep the button focusable with `aria-disabled="true"`, block the click in code, and link the reason with `aria-describedby`. Avoid it when the reason is critical and needs to be visible without hovering; show it inline then.
- Takeaway for PiCollection: reuse the `InfoTooltip` bubble style, open it on `:hover` and `:focus-within`, and say when the action will work again.
- Source: Making Disabled Buttons More Inclusive (CSS-Tricks) - https://css-tricks.com/making-disabled-buttons-more-inclusive/ ; aria-disabled (a11y-101) - https://a11y-101.com/development/aria-disabled
- Checked: 2026-09-27

### Before/after comparison slider
- Kind: pattern
- Use when / avoid when: comparing two versions of the same picture. Expose the divider as a slider (`role="slider"` or a native range input) with a label and an `aria-valuetext` that says what each side shows; arrows/Home/End must work and clicking the track must jump there. Keep the handle at least 24x24 px with a visible focus ring. Avoid it for two different pictures (show them side by side instead).
- Takeaway for PiCollection: a transparent native `<input type="range">` over the stage gives all of that for free.
- Source: ARIA slider role (MDN) - https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/slider_role ; Accessible slider guide - https://accessibility.build/guides/accessible-slider
- Checked: 2026-09-27

### Image viewer zoom and pan
- Kind: pattern
- Use when / avoid when: a full-size image viewer. Zoom keeps the point under the cursor still, drag pans once zoomed, and visible zoom controls exist alongside the gestures so the feature is discoverable. Load the full-resolution file, since a zoomed low-res preview is useless.
- Takeaway for PiCollection: the Lightbox already shows the original file, so zoom works on real pixels; buttons carry their keyboard shortcut in the label.
- Source: Understanding and supporting zoom behaviors on the web (LogRocket) - https://blog.logrocket.com/understanding-supporting-zoom-behaviors-web/ ; Image Zoom design pattern - https://ui-patterns.com/patterns/ImageZoom ; Baymard, image gestures - https://baymard.com/blog/mobile-image-gestures
- Checked: 2026-09-27

## Anti-patterns

### Tooltip on a natively disabled button
- Kind: anti-pattern
- Use when / avoid when: the `disabled` attribute drops the button from the tab order and pointer events, so keyboard and screen reader users never get the tooltip explaining why. Use `aria-disabled` instead (see the pattern above).
- Takeaway for PiCollection: never put the only explanation of a disabled state behind a `disabled` button's hover.
- Source: MUI issue #33182 - https://github.com/mui/material-ui/issues/33182 ; react-spectrum discussion #9232 - https://github.com/adobe/react-spectrum/discussions/9232
- Checked: 2026-09-27

## Trends

(none recorded yet)
