# Changes made from other projects

Changes to this repo made from a Claude Code session opened in a *different*
project (mostly `C:\MyProjects\PiCollection_Researcher`, the PiCollection
Capture browser extension). Each entry records where the change came from,
why, and which files it touched, plus a ready-to-use bullet for the GitHub
release notes.

When an entry ships in a release, move it under that version's heading
(or delete it once it's in the release notes).

## Unreleased

### Extension capture: link booru names to existing library entries

- **Date:** 2026-09-26
- **Origin:** session in `PiCollection_Researcher` (PiCollection Capture
  extension), while testing captures from Danbooru against the 1.5.0 build.
- **Problem:** `/capture` matched names by exact case-insensitive string
  only. Booru names (`closed_eyes`, `sylphiette_(mushoku_tensei)`) never
  matched library entries (`Closed eyes`, `Sylphiette`), so every capture
  created duplicate tags/characters/series. Multi-artist posts arrived
  comma-joined (`keihh, sketchdrif`) and created one artist with that
  literal name.
- **Change** (`src/main/services/extensionBridge.service.ts`):
  - Names compare ignoring case, underscores and extra spacing, and also
    against each entity's aliases.
  - Characters also match with the trailing `(series)` qualifier removed.
    General tags don't, since there the qualifier is meaningful
    (`bow_(weapon)` vs `bow`).
  - New tags/characters/series are created with spaces and the first letter
    capitalized (`anime_coloring` → `Anime coloring`). Artists keep their
    casing.
  - A comma-separated `artistName` links the first artist already in the
    library; if none is known, only the first name is created.
  - `/lookup` results carry `exact: true` on the entity a capture would
    link to, so the extension's "exists / new" badge agrees with what saving
    does. The field is optional, so older extension builds are unaffected.
- **Tests:** `src/main/services/extensionBridge.service.test.ts`
  (lookup + "capture name matching" blocks).
- **Companion change in the extension:** the popup reads `exact` and checks
  multiple artists individually.
- **Release note bullets:**
  - Browser extension captures now reuse your existing tags, characters,
    series and artists instead of creating booru-style duplicates
    (`closed_eyes` → `Closed eyes`, aliases included).
  - Posts with several artists link the one already in your library
    instead of creating a combined "artist1, artist2" entry.
  - New tags/characters/series created from captures use spaces and a
    capitalized first letter.
