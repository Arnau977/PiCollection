/** A suggested entity name, already cleaned of booru formatting (underscores, whitespace). */
export interface SauceNaoName {
  /** De-qualified display/creation form, e.g. "Ishtar". */
  name: string
  /** Extra keys to try when matching existing entities, e.g. "Ishtar (Fate)". */
  altNames?: string[]
}

export interface SauceNaoArtist extends SauceNaoName {
  /** Artist's own profile URL (Pixiv/Twitter), distinct from `sourceUrl` - only set when the index exposes an artist id/handle, not just the artwork link. */
  socialUrl?: string
  /** Platform name for `socialUrl`, e.g. "Pixiv" or "Twitter". */
  socialLabel?: string
}

export interface SauceNaoMatch {
  /** 0-100. */
  similarity: number
  /** The matched booru/index name, e.g. "Danbooru". */
  indexName: string
  /** First known source URL for the match, if any. */
  sourceUrl?: string
  /** Shown for context only - never written into the media's own name field. */
  title?: string
  artist: SauceNaoArtist | null
  characters: SauceNaoName[]
  series: SauceNaoName[]
  /**
   * Series implied by character qualifiers ("Ishtar (Fate)" -> "Fate") that
   * aren't already covered by `series`. Only ever used to select a series
   * that already exists in the library - qualifiers are often abbreviated
   * ("Fate" vs "Fate/Grand Order") so they're never offered for creation.
   */
  seriesHints: SauceNaoName[]
  tags: SauceNaoName[]
}

export interface SauceNaoLookup {
  /** null = searched successfully, nothing above the similarity threshold. */
  match: SauceNaoMatch | null
  /** SauceNAO's own remaining-search counters, for a "N searches left" hint. */
  remaining: { short: number; long: number }
}
