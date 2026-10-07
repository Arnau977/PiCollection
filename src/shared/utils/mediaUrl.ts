function toProtocolUrl(host: 'media' | 'thumb', route: string): string {
  // Encoded per segment: encodeURI would leave '#' and '?' as-is, so a file
  // named "a (#1).png" got cut at the '#' (read as a fragment) and 404'd. The
  // drive's ':' is kept readable; the protocol handler decodes either form.
  const path = route
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/%3A/gi, ':'))
    .join('/')
  return `app://${host}/${path}`
}

/** URL for the original file, used by the detail view and the lightbox. */
export function toMediaUrl(route: string): string {
  return toProtocolUrl('media', route)
}

/**
 * URL for a small cached preview, used by grids and lists. Falls back to the
 * original file for images the OS cannot thumbnail; videos 404 instead.
 */
export function toThumbUrl(route: string): string {
  return toProtocolUrl('thumb', route)
}
