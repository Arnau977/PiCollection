/**
 * Danbooru wiki bodies use "DText" markup (Textile-like: [b]...[/b],
 * [[wiki links]], "h4. " headers, "* " bullets) rather than real Markdown.
 * This strips the tokens that would otherwise show up literally in a
 * plain-text popover - not a full DText renderer, just enough to read as
 * prose. Line breaks are left as-is; the caller renders them via CSS
 * `white-space: pre-line`. Post/pool references are left intact for
 * `splitDtextLinks` to turn into actual links.
 */
export function stripDtext(raw: string): string {
  return raw
    .replace(/\[\/?b\]/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^h[1-6]\.\s*/gm, '')
    .replace(/^\*\s+/gm, '- ')
    .replace(/!post\b/gi, 'post')
}

export interface DtextSegment {
  text: string
  /** Set when this segment is a post/pool reference - render as a link
   * instead of a bare, unexplained number. */
  href?: string
  /** Set when this segment was wrapped in [spoiler]...[/spoiler] - render
   * hidden until hovered/focused instead of as plain prose. Content inside
   * is treated as plain text, not re-scanned for links - spoilers wrapping
   * a post/pool reference are rare enough that "not a full DText renderer,
   * just enough to read as prose" (see stripDtext) still applies here. */
  spoiler?: boolean
}

const LINK_PATTERN =
  /\[spoiler\]([\s\S]*?)\[\/spoiler\]|pool #(\d+)|post #(\d+)|\{\{pool:([^}]+)\}\}|"([^"]+)":\s*\[?(https?:\/\/[^\s\]]+)\]?/gi

/** Splits `stripDtext`'s output around post/pool references, named external
 * links (`"text":url` / `"text":[url]`), and [spoiler] blocks so the caller
 * can render each one appropriately (a link, or hidden-until-revealed
 * text). */
export function splitDtextLinks(text: string): DtextSegment[] {
  const segments: DtextSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, index) })
    }

    const [full, spoilerText, poolId, postId, poolName, linkText, linkUrl] = match
    if (spoilerText !== undefined) {
      segments.push({ text: spoilerText, spoiler: true })
    } else if (poolId) {
      segments.push({ text: full, href: `https://danbooru.donmai.us/pools/${poolId}` })
    } else if (postId) {
      segments.push({ text: full, href: `https://danbooru.donmai.us/posts/${postId}` })
    } else if (poolName) {
      segments.push({
        text: poolName.replace(/_/g, ' '),
        href: `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(`pool:${poolName}`)}`
      })
    } else if (linkText && linkUrl) {
      segments.push({ text: linkText, href: linkUrl })
    }
    lastIndex = index + full.length
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) })
  }
  return segments
}
