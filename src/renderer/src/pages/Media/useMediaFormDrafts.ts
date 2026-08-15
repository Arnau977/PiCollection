import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { ArtistModel, CharacterModel, MediaInput, SeriesModel, TagModel } from '@shared/models'
import { normalizeEntityName } from '../../utils/matchEntityNames'
import { resolvePendingId } from './resolvePendingId'

interface EntityList<T> {
  data: T[]
  refetch: () => void
}

interface UseMediaFormDraftsArgs {
  input: MediaInput
  setInput: Dispatch<SetStateAction<MediaInput>>
  artists: EntityList<ArtistModel>
  tags: EntityList<TagModel>
  characters: EntityList<CharacterModel>
  series: EntityList<SeriesModel>
}

export interface MediaFormSaveResolution {
  resolvedInput: MediaInput
  resolvedSeriesIds: string[]
  resolvedCharacterIds: string[]
}

export interface MediaFormDrafts {
  pendingArtists: ArtistModel[]
  pendingTags: TagModel[]
  pendingCharacters: CharacterModel[]
  pendingSeries: SeriesModel[]
  createArtist: (name: string, social?: { name: string; url: string }) => void
  createTag: (name: string) => void
  createCharacter: (name: string, seriesIds?: string[]) => void
  createSeries: (name: string) => string
  /**
   * A "missing" series chip isn't always actually missing - a SauceNAO series
   * hint (a qualifier peeled off a character name, e.g. "Fate" from
   * "Ishtar (Fate)") is deliberately routed through this same chip instead of
   * auto-applied, since it's a guess rather than confirmed data, but the
   * series it names may well already exist in the library. Attach that
   * existing entity instead of creating a same-named duplicate.
   */
  attachExistingOrCreateSeries: (name: string) => string
  /** Resolves every pending draft referenced by `input` into a real id (creating or
   * reusing a same-named library entity), ready to send over IPC. */
  resolveForSave: (overrides?: Partial<MediaInput>) => Promise<MediaFormSaveResolution>
  /** Refetches only the entity lists that actually gained a new item this save. */
  refetchCreated: () => void
}

/**
 * Owns every "pending" (not-yet-saved) artist/tag/character/series draft
 * created while filling out the form - via manual autocomplete creation or a
 * SauceNAO/WD14 suggestion chip - plus resolving them into real ids on save.
 * A draft only becomes a real library row once the form actually saves, so a
 * cancelled edit never litters the library with unused entities.
 */
export function useMediaFormDrafts({
  input,
  setInput,
  artists,
  tags,
  characters,
  series
}: UseMediaFormDraftsArgs): MediaFormDrafts {
  const [pendingTags, setPendingTags] = useState<TagModel[]>([])
  const [pendingSeries, setPendingSeries] = useState<SeriesModel[]>([])
  const [pendingCharacters, setPendingCharacters] = useState<CharacterModel[]>([])
  const [pendingArtists, setPendingArtists] = useState<ArtistModel[]>([])
  const pendingCharacterSeriesIds = useRef(new Map<string, string[]>())
  const pendingArtistSocials = useRef(new Map<string, { name: string; url: string }>())

  function createArtist(name: string, social?: { name: string; url: string }): void {
    const draft: ArtistModel = { id: crypto.randomUUID(), name }
    setPendingArtists((prev) => [...prev, draft])
    if (social) pendingArtistSocials.current.set(draft.id, social)
    setInput((prev) => ({ ...prev, artistId: draft.id }))
  }

  function createTag(name: string): void {
    const tag: TagModel = { id: crypto.randomUUID(), name }
    setPendingTags((prev) => [...prev, tag])
    setInput((prev) => ({ ...prev, tagIds: [...(prev.tagIds ?? []), tag.id] }))
  }

  function createCharacter(name: string, seriesIds?: string[]): void {
    const draft: CharacterModel = { id: crypto.randomUUID(), name, series: [] }
    setPendingCharacters((prev) => [...prev, draft])
    if (seriesIds && seriesIds.length > 0)
      pendingCharacterSeriesIds.current.set(draft.id, seriesIds)
    setInput((prev) => ({
      ...prev,
      characterIds: [...(prev.characterIds ?? []), draft.id]
    }))
  }

  function createSeries(name: string): string {
    const draft: SeriesModel = { id: crypto.randomUUID(), name }
    setPendingSeries((prev) => [...prev, draft])
    setInput((prev) => ({ ...prev, seriesIds: [...(prev.seriesIds ?? []), draft.id] }))
    return draft.id
  }

  function attachExistingOrCreateSeries(name: string): string {
    const existing = series.data.find(
      (candidate) => normalizeEntityName(candidate.name) === normalizeEntityName(name)
    )
    if (existing) {
      setInput((prev) => ({
        ...prev,
        seriesIds: prev.seriesIds?.includes(existing.id)
          ? prev.seriesIds
          : [...(prev.seriesIds ?? []), existing.id]
      }))
      return existing.id
    }
    return createSeries(name)
  }

  async function resolvePendingTagIds(): Promise<Map<string, string>> {
    const toResolve = pendingTags.filter((draft) => (input.tagIds ?? []).includes(draft.id))
    if (toResolve.length === 0) return new Map()

    const freshResult = await window.api.tag.getAll()
    const freshTags = freshResult.success ? freshResult.data : tags.data

    const entries = await Promise.all(
      toResolve.map(
        async (draft) =>
          [
            draft.id,
            await resolvePendingId(draft.id, pendingTags, freshTags, (name) =>
              window.api.tag.create({ name })
            )
          ] as const
      )
    )
    return new Map(entries)
  }

  async function resolvePendingSeriesIds(): Promise<Map<string, string>> {
    const referenced = new Set([
      ...(input.seriesIds ?? []),
      ...pendingCharacters.flatMap((c) => pendingCharacterSeriesIds.current.get(c.id) ?? [])
    ])
    const toResolve = pendingSeries.filter((draft) => referenced.has(draft.id))
    if (toResolve.length === 0) return new Map()

    const freshResult = await window.api.series.getAll()
    const freshSeries = freshResult.success ? freshResult.data : series.data

    const entries = await Promise.all(
      toResolve.map(
        async (draft) =>
          [
            draft.id,
            await resolvePendingId(draft.id, pendingSeries, freshSeries, (name) =>
              window.api.series.create({ name })
            )
          ] as const
      )
    )
    return new Map(entries)
  }

  async function resolvePendingArtistId(): Promise<string | undefined> {
    const draft = pendingArtists.find((p) => p.id === input.artistId)
    if (!draft) return input.artistId

    const freshResult = await window.api.artist.getAll()
    const freshArtists = freshResult.success ? freshResult.data : artists.data
    const match = freshArtists.find((a) => a.name.toLowerCase() === draft.name.toLowerCase())
    if (match) return match.id

    const result = await window.api.artist.create({ name: draft.name })
    if (!result.success) throw new Error(result.error.message)
    const social = pendingArtistSocials.current.get(draft.id)
    if (social) await window.api.artist.addSocialLink(result.data.id, social)
    return result.data.id
  }

  async function resolvePendingCharacterIds(
    seriesIdMap: Map<string, string>
  ): Promise<Map<string, string>> {
    const toResolve = pendingCharacters.filter((draft) =>
      (input.characterIds ?? []).includes(draft.id)
    )
    if (toResolve.length === 0) return new Map()

    const freshResult = await window.api.character.getAll()
    const freshCharacters = freshResult.success ? freshResult.data : characters.data

    const entries = await Promise.all(
      toResolve.map(async (draft) => {
        const match = freshCharacters.find((c) => c.name.toLowerCase() === draft.name.toLowerCase())
        if (match) return [draft.id, match.id] as const

        const seriesIds = (pendingCharacterSeriesIds.current.get(draft.id) ?? []).map(
          (id) => seriesIdMap.get(id) ?? id
        )
        const result = await window.api.character.create({ name: draft.name, seriesIds })
        if (!result.success) throw new Error(result.error.message)
        return [draft.id, result.data.id] as const
      })
    )
    return new Map(entries)
  }

  async function resolveForSave(overrides?: Partial<MediaInput>): Promise<MediaFormSaveResolution> {
    const [seriesIdMap, tagIdMap, resolvedArtistId] = await Promise.all([
      resolvePendingSeriesIds(),
      resolvePendingTagIds(),
      resolvePendingArtistId()
    ])
    const characterIdMap = await resolvePendingCharacterIds(seriesIdMap)

    const resolvedSeriesIds = (input.seriesIds ?? []).map((id) => seriesIdMap.get(id) ?? id)
    const resolvedCharacterIds = (input.characterIds ?? []).map(
      (id) => characterIdMap.get(id) ?? id
    )
    const resolvedInput: MediaInput = {
      ...input,
      ...overrides,
      artistId: resolvedArtistId,
      tagIds: (input.tagIds ?? []).map((id) => tagIdMap.get(id) ?? id),
      characterIds: resolvedCharacterIds,
      seriesIds: resolvedSeriesIds
    }
    return { resolvedInput, resolvedSeriesIds, resolvedCharacterIds }
  }

  function refetchCreated(): void {
    if (pendingTags.length > 0) tags.refetch()
    if (pendingArtists.length > 0) artists.refetch()
    if (pendingSeries.length > 0) series.refetch()
    if (pendingCharacters.length > 0) characters.refetch()
  }

  return {
    pendingArtists,
    pendingTags,
    pendingCharacters,
    pendingSeries,
    createArtist,
    createTag,
    createCharacter,
    createSeries,
    attachExistingOrCreateSeries,
    resolveForSave,
    refetchCreated
  }
}
