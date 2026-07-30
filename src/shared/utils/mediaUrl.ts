function toProtocolUrl(host: 'media' | 'thumb', route: string): string {
  return `app://${host}/${encodeURI(route.replace(/\\/g, '/'))}`
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
