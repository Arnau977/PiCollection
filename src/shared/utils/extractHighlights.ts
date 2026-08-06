const HIGHLIGHTS_HEADING = /^##\s*Highlights\s*$/im
const NEXT_HEADING = /^##\s+/m
const PLACEHOLDER = '_Fill in 2-3 bullet points of user-facing changes before publishing._'

/**
 * Pulls the human-written summary out of a release's `## Highlights` section
 * (see `.github/workflows/release.yml`, which seeds every draft release with
 * this heading and the placeholder text below it). Returns null whenever
 * there's nothing meaningful to show - no heading, an empty section, or one
 * still containing the unfilled placeholder - so callers never special-case
 * "forgotten" versus "absent".
 */
export function extractHighlights(releaseNotes: string | null | undefined): string | null {
  if (!releaseNotes) return null

  const headingMatch = HIGHLIGHTS_HEADING.exec(releaseNotes)
  if (!headingMatch) return null

  const afterHeading = releaseNotes.slice(headingMatch.index + headingMatch[0].length)
  const nextHeadingMatch = NEXT_HEADING.exec(afterHeading)
  const body = nextHeadingMatch ? afterHeading.slice(0, nextHeadingMatch.index) : afterHeading

  const trimmed = body.trim()
  if (!trimmed || trimmed === PLACEHOLDER) return null

  return trimmed
}
