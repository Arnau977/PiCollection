import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { ArtistModel, CharacterModel, MediaInput, SeriesModel, TagModel } from '@shared/models'
import { normalizeEntityName } from '../../../utils/matchEntityNames'
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
  /** Draft id -> the real id it resolved to, for `commitSaved`. */
  idMap: Map<string, string>
}

export interface MediaFormDrafts {
  pendingArtists: ArtistModel[]
  pendingTags: TagModel[]
  pendingCharacters: CharacterModel[]
  pendingSeries: SeriesModel[]
  createArtist: (name: string, social?: { name: string; url: string }) => void
  createTag: (name: string) => void
  /** `parentName`: create it as a form/costume of that character (created too if missing). */
  createCharacter: (name: string, parentName?: string) => void
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
  /**
   * After a successful save: points the form at the real ids its drafts
   * became, so a later save (the queue's Save stays on the item) doesn't
   * treat them as new again - or send them next to the same tag picked
   * directly, which the main process rejects as a missing tag.
   */
  commitSaved: (idMap: Map<string, string>) => void
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
  const pendingArtistSocials = useRef(new Map<string, { name: string; url: string }>())
  const pendingCharacterParents = useRef(new Map<string, string>())
  // Same-named characters that already existed when a draft was made. The
  // draft is someone else who shares the name ("Asuna" of Blue Archive next
  // to SAO's): suggestion matching ruled them out, and the picker never
  // offers "Create" for a name that exists - so saving must not reuse them.
  const pendingCharacterNamesakes = useRef(new Map<string, Set<string>>())

  // A committed draft keeps showing (under its real id) until the refetched
  // list has it, so its chip never blinks out in between.
  const notYetListed = <T extends { id: string }>(drafts: T[], listed: T[]): T[] =>
    drafts.filter((draft) => !listed.some((entity) => entity.id === draft.id))

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

  // A new character starts with no series of its own: its series is only
  // derived from what the media actually ends up tagged with (see
  // linkCharactersToSoleSeries), never from a suggestion the user didn't accept.
  function createCharacter(name: string, parentName?: string): void {
    const draft: CharacterModel = { id: crypto.randomUUID(), name, series: [] }
    setPendingCharacters((prev) => [...prev, draft])
    if (parentName) pendingCharacterParents.current.set(draft.id, parentName)
    const namesakes = characters.data.filter(
      (c) => normalizeEntityName(c.name) === normalizeEntityName(name)
    )
    if (namesakes.length > 0) {
      pendingCharacterNamesakes.current.set(draft.id, new Set(namesakes.map((c) => c.id)))
    }
    // The form replaces its base character (applied earlier by the suggestion):
    // searches for the base still find it through the character hierarchy.
    const parent = parentName
      ? characters.data.find((c) => normalizeEntityName(c.name) === normalizeEntityName(parentName))
      : undefined
    setInput((prev) => ({
      ...prev,
      characterIds: [...(prev.characterIds ?? []).filter((id) => id !== parent?.id), draft.id]
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
    const toResolve = pendingSeries.filter((draft) => (input.seriesIds ?? []).includes(draft.id))
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

  // Resolving can turn a draft into a tag that's also selected directly.
  const unique = (ids: string[]): string[] => [...new Set(ids)]

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

  async function resolvePendingCharacterIds(): Promise<Map<string, string>> {
    const toResolve = pendingCharacters.filter((draft) =>
      (input.characterIds ?? []).includes(draft.id)
    )
    if (toResolve.length === 0) return new Map()

    const freshResult = await window.api.character.getAll()
    const freshCharacters = freshResult.success ? freshResult.data : characters.data

    const createdByName = new Map<string, string>()
    async function findOrCreate(
      name: string,
      parentId?: string,
      namesakes = new Set<string>()
    ): Promise<string> {
      const key = normalizeEntityName(name)
      const existing =
        createdByName.get(key) ??
        freshCharacters.find((c) => normalizeEntityName(c.name) === key && !namesakes.has(c.id))?.id
      if (existing) return existing
      const result = await window.api.character.create({ name, seriesIds: [], parentId })
      if (!result.success) throw new Error(result.error.message)
      createdByName.set(key, result.data.id)
      return result.data.id
    }

    // One at a time: two forms of the same new base character must create it once.
    const resolved = new Map<string, string>()
    for (const draft of toResolve) {
      const parentName = pendingCharacterParents.current.get(draft.id)
      const parentId = parentName ? await findOrCreate(parentName) : undefined
      resolved.set(
        draft.id,
        await findOrCreate(draft.name, parentId, pendingCharacterNamesakes.current.get(draft.id))
      )
    }
    return resolved
  }

  async function resolveForSave(overrides?: Partial<MediaInput>): Promise<MediaFormSaveResolution> {
    const [seriesIdMap, tagIdMap, resolvedArtistId, characterIdMap] = await Promise.all([
      resolvePendingSeriesIds(),
      resolvePendingTagIds(),
      resolvePendingArtistId(),
      resolvePendingCharacterIds()
    ])

    const idMap = new Map([...seriesIdMap, ...tagIdMap, ...characterIdMap])
    if (input.artistId && resolvedArtistId && resolvedArtistId !== input.artistId) {
      idMap.set(input.artistId, resolvedArtistId)
    }
    const resolvedInput = remapIds({ ...input, ...overrides }, idMap)
    return {
      resolvedInput,
      resolvedSeriesIds: resolvedInput.seriesIds ?? [],
      resolvedCharacterIds: resolvedInput.characterIds ?? [],
      idMap
    }
  }

  function remapIds(target: MediaInput, idMap: Map<string, string>): MediaInput {
    const remap = (ids: string[] | undefined): string[] =>
      unique((ids ?? []).map((id) => idMap.get(id) ?? id))
    return {
      ...target,
      artistId: target.artistId && (idMap.get(target.artistId) ?? target.artistId),
      tagIds: remap(target.tagIds),
      characterIds: remap(target.characterIds),
      seriesIds: remap(target.seriesIds)
    }
  }

  function commitSaved(idMap: Map<string, string>): void {
    if (idMap.size === 0) return
    const rekey = <T extends { id: string }>(drafts: T[]): T[] =>
      drafts.map((draft) => ({ ...draft, id: idMap.get(draft.id) ?? draft.id }))
    setInput((prev) => remapIds(prev, idMap))
    setPendingTags(rekey)
    setPendingSeries(rekey)
    setPendingCharacters(rekey)
    setPendingArtists(rekey)
  }

  function refetchCreated(): void {
    if (pendingTags.length > 0) tags.refetch()
    if (pendingArtists.length > 0) artists.refetch()
    if (pendingSeries.length > 0) series.refetch()
    if (pendingCharacters.length > 0) characters.refetch()
  }

  return {
    pendingArtists: notYetListed(pendingArtists, artists.data),
    pendingTags: notYetListed(pendingTags, tags.data),
    pendingCharacters: notYetListed(pendingCharacters, characters.data),
    pendingSeries: notYetListed(pendingSeries, series.data),
    createArtist,
    createTag,
    createCharacter,
    createSeries,
    attachExistingOrCreateSeries,
    resolveForSave,
    commitSaved,
    refetchCreated
  }
}
