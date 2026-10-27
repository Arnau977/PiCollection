import type { CharacterModel, SeriesModel } from '@shared/models'
import { parseCharacterTag } from '@shared/utils'
import { normalizeEntityName, qualifierNamesSeries } from '../../../utils/matchEntityNames'

type NamedCharacter = Pick<CharacterModel, 'id' | 'name' | 'aliases'>

/**
 * The base character a newly typed name is a form of, read the booru way:
 * "Gold Ship (Summer)" is a form of "Gold Ship"; with the series kept in
 * the name, "gold ship (run! ruin! launcher!) (Umamusume)" is a form of
 * "Gold ship (Umamusume)". A lone qualifier that names one of the library's
 * series ("Asuna (Blue Archive)") is the series, not a form - no parent.
 * Only an existing character (or another draft in the form) counts.
 */
export function detectCharacterParent(
  name: string,
  candidates: NamedCharacter[],
  librarySeries: Pick<SeriesModel, 'name' | 'aliases'>[]
): NamedCharacter | null {
  const { base, qualifiers } = parseCharacterTag(name)
  if (qualifiers.length === 0) return null
  if (
    qualifiers.length === 1 &&
    librarySeries.some((series) =>
      [series.name, ...(series.aliases ?? [])].some((seriesName) =>
        qualifierNamesSeries(qualifiers[0], seriesName)
      )
    )
  ) {
    return null
  }

  const self = normalizeEntityName(name)
  const lastQualifier = qualifiers[qualifiers.length - 1]
  const baseNames = qualifiers.length >= 2 ? [`${base} (${lastQualifier})`, base] : [base]
  for (const baseName of baseNames) {
    const wanted = normalizeEntityName(baseName)
    const found = candidates.find(
      (character) =>
        normalizeEntityName(character.name) !== self &&
        [character.name, ...(character.aliases ?? [])].some(
          (candidateName) => normalizeEntityName(candidateName) === wanted
        )
    )
    if (found) return found
  }
  return null
}
