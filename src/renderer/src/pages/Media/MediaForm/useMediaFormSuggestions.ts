import type { Dispatch, SetStateAction } from 'react'
import type { ArtistModel, CharacterModel, MediaInput, SeriesModel, TagModel } from '@shared/models'
import { useSauceNaoApiKey } from '../../../hooks/useSauceNaoApiKey'
import { useSauceNaoSuggestions, type SuggestionCategory } from '../../../hooks/useSauceNaoSuggestions'
import { useWd14Runtime } from '../../../hooks/useWd14Runtime'
import { useWd14Suggestions } from '../../../hooks/useWd14Suggestions'
import { titleCaseTagName } from '../../../utils/matchEntityNames'
import { withImpliedSeries } from '../../../utils/withImpliedSeries'
import type { MediaFormDrafts } from './useMediaFormDrafts'

interface EntityList<T> {
  data: T[]
}

interface EntityListWithRefetch<T> extends EntityList<T> {
  refetch: () => void
}

interface UseMediaFormSuggestionsArgs {
  input: MediaInput
  setInput: Dispatch<SetStateAction<MediaInput>>
  artists: EntityList<ArtistModel>
  tags: EntityList<TagModel>
  characters: EntityListWithRefetch<CharacterModel>
  series: EntityList<SeriesModel>
  drafts: MediaFormDrafts
}

export interface MediaFormSuggestions {
  hasSauceNaoApiKey: boolean
  sauce: ReturnType<typeof useSauceNaoSuggestions>
  wd14Runtime: ReturnType<typeof useWd14Runtime>
  wd14: ReturnType<typeof useWd14Suggestions>
  addMissingSuggestion: (category: SuggestionCategory, name: string) => Promise<void>
  addWd14Suggestion: (
    category: Extract<SuggestionCategory, 'tags' | 'characters' | 'series'>,
    name: string
  ) => Promise<void>
  /**
   * Picking a character that belongs to exactly one series implies that series,
   * so it gets selected automatically. Characters spanning several series stay
   * ambiguous and are left for the user to resolve.
   */
  handleCharactersChange: (characterIds: string[]) => void
  /**
   * If the media ends up tagged with exactly one series, any of its selected
   * characters that aren't already linked to that series in the library get
   * updated to include it - the reverse of the existing "picking a character
   * with exactly one series implies that series" rule, and works regardless
   * of whether the characters/series were picked manually or via a
   * suggestion.
   */
  linkCharactersToSoleSeries: (seriesIds: string[], characterIds: string[]) => Promise<void>
}

/**
 * Wires up the SauceNAO and WD14 suggestion sources, and the character/series
 * implication rules that apply regardless of whether an entity was picked by
 * hand or accepted from a suggestion chip.
 */
export function useMediaFormSuggestions({
  input,
  setInput,
  artists,
  tags,
  characters,
  series,
  drafts
}: UseMediaFormSuggestionsArgs): MediaFormSuggestions {
  const hasSauceNaoApiKey = useSauceNaoApiKey()

  // A suggestion's own matching only ever sees what's actually in the
  // library (tags.data etc.) - a pending draft added earlier in *this* edit
  // (e.g. from an earlier suggestion click, still unsaved) isn't there yet,
  // so without this a second suggestion source re-detecting the same name
  // would offer it again as "new" instead of recognizing the draft.
  const sauce = useSauceNaoSuggestions({
    artists: [...artists.data, ...drafts.pendingArtists],
    tags: [...tags.data, ...drafts.pendingTags],
    characters: [...characters.data, ...drafts.pendingCharacters],
    series: [...series.data, ...drafts.pendingSeries],
    onApplyExisting: ({ artistId, tagIds, characterIds, seriesIds }) => {
      setInput((prev) => {
        const nextCharacterIds = Array.from(
          new Set([...(prev.characterIds ?? []), ...characterIds])
        )
        const addedCharacterIds = nextCharacterIds.filter(
          (id) => !(prev.characterIds ?? []).includes(id)
        )
        const nextSeriesIds = Array.from(new Set([...(prev.seriesIds ?? []), ...seriesIds]))
        return {
          ...prev,
          // Suggestions only ever add - never overwrite a choice already made.
          artistId: prev.artistId ?? artistId,
          tagIds: Array.from(new Set([...(prev.tagIds ?? []), ...tagIds])),
          characterIds: nextCharacterIds,
          seriesIds: withImpliedSeries(characters.data, addedCharacterIds, nextSeriesIds)
        }
      })
    }
  })

  const wd14Runtime = useWd14Runtime()
  const wd14 = useWd14Suggestions({
    tags: [...tags.data, ...drafts.pendingTags],
    characters: [...characters.data, ...drafts.pendingCharacters],
    series: [...series.data, ...drafts.pendingSeries],
    onApplyExisting: ({ tagIds, characterIds, seriesIds }) => {
      setInput((prev) => {
        const nextCharacterIds = Array.from(
          new Set([...(prev.characterIds ?? []), ...characterIds])
        )
        const addedCharacterIds = nextCharacterIds.filter(
          (id) => !(prev.characterIds ?? []).includes(id)
        )
        const nextSeriesIds = Array.from(new Set([...(prev.seriesIds ?? []), ...seriesIds]))
        return {
          ...prev,
          tagIds: Array.from(new Set([...(prev.tagIds ?? []), ...tagIds])),
          characterIds: nextCharacterIds,
          seriesIds: withImpliedSeries(characters.data, addedCharacterIds, nextSeriesIds)
        }
      })
    }
  })

  function handleCharactersChange(characterIds: string[]): void {
    setInput((prev) => {
      const previouslySelected = prev.characterIds ?? []
      const added = characterIds.filter((id) => !previouslySelected.includes(id))
      return {
        ...prev,
        characterIds,
        seriesIds: withImpliedSeries(characters.data, added, prev.seriesIds ?? [])
      }
    })
  }

  /**
   * A new character should link to its series the same way manually picking
   * an existing single-series character already does (see `withImpliedSeries`
   * above). If the only suggested series is itself still unconfirmed (a
   * "missing" chip, not yet created), create/attach it now instead of
   * leaving the character unlinked until the user separately clicks that
   * chip too - there's nothing ambiguous to resolve when only one candidate
   * exists. (If a series suggestion *was* auto-applied, `input.seriesIds` is
   * already non-empty by the time this runs, so the check below never needs
   * to separately count applied + missing suggestions.)
   */
  async function resolveSoleMissingSeries(
    missingSeriesNames: string[],
    dismissSeries: (name: string) => void
  ): Promise<string[]> {
    const current = input.seriesIds ?? []
    if (current.length > 0) return current
    if (missingSeriesNames.length !== 1) return current

    const soleSeriesName = missingSeriesNames[0]
    const seriesId = drafts.attachExistingOrCreateSeries(soleSeriesName)
    dismissSeries(soleSeriesName)
    return [seriesId]
  }

  async function addMissingSuggestion(category: SuggestionCategory, name: string): Promise<void> {
    if (category === 'artist') {
      const artist = sauce.match?.artist
      const social =
        artist?.name === name && artist.socialUrl
          ? { name: artist.socialLabel ?? 'Link', url: artist.socialUrl }
          : undefined
      drafts.createArtist(name, social)
    } else if (category === 'tags') drafts.createTag(name)
    else if (category === 'characters') {
      const seriesIds = await resolveSoleMissingSeries(sauce.missing.series, (seriesName) =>
        sauce.dismiss('series', seriesName)
      )
      drafts.createCharacter(name, seriesIds)
    } else drafts.attachExistingOrCreateSeries(name)
    sauce.dismiss(category, name)
  }

  async function addWd14Suggestion(
    category: Extract<SuggestionCategory, 'tags' | 'characters' | 'series'>,
    name: string
  ): Promise<void> {
    if (category === 'tags') {
      // The model's raw output is all-lowercase; title-case only the tag
      // that actually gets created, not the name used to look it up in the
      // wiki or to dismiss it from the suggestion list below.
      drafts.createTag(titleCaseTagName(name))
    } else if (category === 'characters') {
      const missingSeriesNames = wd14.missing.series.map((entry) => entry.name)
      const seriesIds = await resolveSoleMissingSeries(missingSeriesNames, (seriesName) =>
        wd14.dismiss('series', seriesName)
      )
      drafts.createCharacter(name, seriesIds)
    } else {
      drafts.attachExistingOrCreateSeries(name)
    }
    wd14.dismiss(category, name)
  }

  async function linkCharactersToSoleSeries(
    seriesIds: string[],
    characterIds: string[]
  ): Promise<void> {
    if (seriesIds.length !== 1) return
    const [soleSeriesId] = seriesIds

    const toUpdate = characterIds
      .map((id) => characters.data.find((character) => character.id === id))
      .filter(
        (character): character is CharacterModel =>
          character != null && !character.series.some((linked) => linked.id === soleSeriesId)
      )
    if (toUpdate.length === 0) return

    await Promise.all(
      toUpdate.map((character) =>
        window.api.character.update(character.id, {
          name: character.name,
          seriesIds: [...character.series.map((linked) => linked.id), soleSeriesId],
          aliases: character.aliases
        })
      )
    )
    characters.refetch()
  }

  return {
    hasSauceNaoApiKey,
    sauce,
    wd14Runtime,
    wd14,
    addMissingSuggestion,
    addWd14Suggestion,
    handleCharactersChange,
    linkCharactersToSoleSeries
  }
}
