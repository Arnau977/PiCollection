import type { CharacterModel } from '@shared/models'

/**
 * Stable-sorts `characters` so any character linked to one of
 * `selectedSeriesIds` comes first, preserving relative order within each
 * group - surfaces series-relevant characters in Add/Edit Media without
 * requiring a new IPC/DB query, since `.series` is already loaded.
 */
export function sortCharactersByRelevance(
  characters: CharacterModel[],
  selectedSeriesIds: string[]
): CharacterModel[] {
  if (selectedSeriesIds.length === 0) return [...characters]

  const selected = new Set(selectedSeriesIds)
  const isRelevant = (character: CharacterModel): boolean =>
    character.series.some((s) => selected.has(s.id))

  const relevant = characters.filter(isRelevant)
  const rest = characters.filter((c) => !isRelevant(c))
  return [...relevant, ...rest]
}
