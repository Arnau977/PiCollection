const HIGHLIGHTS_HEADING = /^##\s*Highlights\s*$/im
const NEXT_HEADING = /^##\s+/m
const PLACEHOLDER = '_Fill in 2-3 bullet points of user-facing changes before publishing._'
/**
 * The same placeholder, but as it reads once GitHub has rendered the
 * markdown italics (`_..._`) to an `<em>` tag and that tag has been stripped
 * back down to plain text (see the HTML path below) - the underscores never
 * survive that round trip, so it needs its own literal to match against.
 */
const PLACEHOLDER_TEXT_ONLY = 'Fill in 2-3 bullet points of user-facing changes before publishing.'

// electron-updater's GitHub provider only reads a `releaseNotes` field out of
// its manifest (latest.yml); this app's manifest doesn't publish one, so it
// always falls back to the releases.atom feed's `<content type="html">`,
// i.e. GitHub's *rendered HTML* of the release body, not the raw markdown.
// A real heading tag (`<h1>`..`<h6>`) is a reliable enough signal to tell
// that path apart from the plain-markdown case handled below.
const HTML_HEADING = /<h[1-6][\s>]/i
// GitHub's rendered headings often lead with an anchor-link tag (wrapping an
// svg icon, no visible text) before the heading's actual text, e.g.
// `<h2 dir="auto"><a id="user-content-highlights" class="anchor" href="#highlights"><svg .../></a>Highlights</h2>` -
// so any run of tags is allowed between the opening `<h2...>` and the text.
const HTML_HIGHLIGHTS_HEADING = /<h2[^>]*>(?:<[^>]+>)*\s*Highlights\s*<\/h2>/i
const HTML_NEXT_H2 = /<h2[\s>]/i
const HTML_LIST_ITEM = /<li[^>]*>([\s\S]*?)<\/li>/gi
const HTML_TAG = /<[^>]+>/g

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Extracts the Highlights section out of GitHub's rendered-HTML release notes (see module comment above). */
function extractHighlightsFromHtml(releaseNotes: string): string | null {
  const headingMatch = HTML_HIGHLIGHTS_HEADING.exec(releaseNotes)
  if (!headingMatch) return null

  const afterHeading = releaseNotes.slice(headingMatch.index + headingMatch[0].length)
  const nextHeadingMatch = HTML_NEXT_H2.exec(afterHeading)
  const body = nextHeadingMatch ? afterHeading.slice(0, nextHeadingMatch.index) : afterHeading

  const listItems = [...body.matchAll(HTML_LIST_ITEM)]
  let text: string
  if (listItems.length > 0) {
    text = listItems
      .map((item) => `- ${decodeHtmlEntities(item[1].replace(HTML_TAG, '').trim())}`)
      .join('\n')
  } else {
    text = decodeHtmlEntities(body.replace(HTML_TAG, '').trim())
  }

  const trimmed = text.trim()
  if (!trimmed || trimmed === PLACEHOLDER_TEXT_ONLY) return null

  return trimmed
}

/**
 * Pulls the human-written summary out of a release's `## Highlights` section
 * (see `.github/workflows/release.yml`, which seeds every draft release with
 * this heading and the placeholder text below it). Returns null whenever
 * there's nothing meaningful to show - no heading, an empty section, or one
 * still containing the unfilled placeholder - so callers never special-case
 * "forgotten" versus "absent".
 *
 * Handles two input shapes: raw markdown (e.g. from a manifest's
 * `releaseNotes` field, or in tests) and GitHub's rendered HTML (what this
 * app actually receives in production - see `extractHighlightsFromHtml`
 * above). Output is always plain text, never HTML, regardless of which path
 * matched - callers render it as a plain text node.
 */
export function extractHighlights(releaseNotes: string | null | undefined): string | null {
  if (!releaseNotes) return null

  if (HTML_HEADING.test(releaseNotes)) {
    return extractHighlightsFromHtml(releaseNotes)
  }

  const headingMatch = HIGHLIGHTS_HEADING.exec(releaseNotes)
  if (!headingMatch) return null

  const afterHeading = releaseNotes.slice(headingMatch.index + headingMatch[0].length)
  const nextHeadingMatch = NEXT_HEADING.exec(afterHeading)
  const body = nextHeadingMatch ? afterHeading.slice(0, nextHeadingMatch.index) : afterHeading

  const trimmed = body.trim()
  if (!trimmed || trimmed === PLACEHOLDER) return null

  return trimmed
}
