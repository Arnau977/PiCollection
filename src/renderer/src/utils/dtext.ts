/**
 * Danbooru wiki bodies use "DText" markup (Textile-like: [b]...[/b],
 * [[wiki links]], "h4. " headers) rather than real Markdown. This strips the
 * tokens that would otherwise show up literally in a plain-text popover -
 * not a full DText renderer, just enough to read as prose. Line breaks are
 * left as-is; the caller renders them via CSS `white-space: pre-line`.
 */
export function stripDtext(raw: string): string {
  return raw
    .replace(/\[\/?b\]/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^h[1-6]\.\s*/gm, '')
    .replace(/!post\b/gi, 'post')
}

export interface DtextSegment {
  text: string
  /** Set when this segment is a "post #12345" reference - render as a link
   * to that post on Danbooru, since a bare post number means nothing on its
   * own without a way to see what it refers to. */
  postId?: string
}

/** Splits `stripDtext`'s output around "post #12345" references so the
 * caller can render each one as a link instead of an unexplained number. */
export function splitDtextPostLinks(text: string): DtextSegment[] {
  const parts = text.split(/post #(\d+)/g)
  const segments: DtextSegment[] = []
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) segments.push({ text: parts[i] })
    } else {
      segments.push({ text: `post #${parts[i]}`, postId: parts[i] })
    }
  }
  return segments
}
