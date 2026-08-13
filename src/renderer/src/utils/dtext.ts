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
