import type { DanbooruCharacterInfo } from '@shared/models'

/**
 * Danbooru's parent character and series for each character tag (cached in
 * the main process). Any failure just means no extra info: suggestions then
 * fall back to reading the tag's parentheses.
 */
export async function fetchDanbooruCharacters(names: string[]): Promise<DanbooruCharacterInfo[]> {
  const unique = Array.from(new Set(names.filter((name) => name.trim()))).slice(0, 50)
  if (unique.length === 0) return []
  const result = await window.api.danbooru.resolveCharacters(unique)
  return result.success ? result.data : []
}
