import type { CharacterModel } from '@shared/models'

/**
 * A character that belongs to exactly one series implies that series, so it
 * gets auto-selected. Characters spanning several series (or none) stay
 * ambiguous and are left for the user to resolve.
 */
export function withImpliedSeries(
  allCharacters: CharacterModel[],
  addedCharacterIds: string[],
  seriesIds: string[]
): string[] {
  const next = [...seriesIds]
  for (const characterId of addedCharacterIds) {
    const character = allCharacters.find((candidate) => candidate.id === characterId)
    const onlySeries = character?.series.length === 1 ? character.series[0] : undefined
    if (onlySeries && !next.includes(onlySeries.id)) {
      next.push(onlySeries.id)
    }
  }
  return next
}
