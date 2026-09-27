/** What Danbooru says about one character tag, e.g. "pyra_(pro_swimmer)_(xenoblade)". */
export interface DanbooruCharacterInfo {
  /** The tag as asked, in Danbooru form (lowercase, underscores). */
  tag: string
  /** The base character this tag is a form/costume of ("pyra_(xenoblade)"), or null. */
  parentTag: string | null
  /** The most specific copyright tags for the (base) character, e.g. ["xenoblade_chronicles_2"]. */
  series: string[]
}
