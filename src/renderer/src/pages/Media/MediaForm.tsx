import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Cpu,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  ScanSearch
} from 'lucide-react'
import type {
  ArtistModel,
  CharacterModel,
  MediaDuplicateCheck,
  MediaInput,
  MediaModel,
  SeriesModel,
  TagModel
} from '@shared/models'
import { deriveMediaName, detectMediaType } from '@shared/utils'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { Autocomplete } from '../../components/Autocomplete/Autocomplete'
import { MultiSelectAutocomplete } from '../../components/Autocomplete/MultiSelectAutocomplete'
import { MediaHoverPreview } from '../../components/MediaHoverPreview/MediaHoverPreview'
import { TagWikiInfo } from '../../components/TagWikiInfo/TagWikiInfo'
import { PATH } from '../../app.routes.const'
import { useArtists, useCharacters, useSeries, useTags } from '../../hooks/useEntityLists'
import { useSauceNaoApiKey } from '../../hooks/useSauceNaoApiKey'
import { useSauceNaoSuggestions, type SuggestionCategory } from '../../hooks/useSauceNaoSuggestions'
import { useWd14Runtime } from '../../hooks/useWd14Runtime'
import { useWd14Suggestions } from '../../hooks/useWd14Suggestions'
import { formatCharacterOptionLabel } from '../../utils/matchEntityNames'
import { sortCharactersByRelevance } from '../../utils/sortCharactersBySeries'
import { withImpliedSeries } from '../../utils/withImpliedSeries'
import { resolvePendingId } from './resolvePendingId'
import './MediaForm.css'

interface InitialFile {
  route: string
  name: string
  type: MediaModel['type']
}

interface QueueInfo {
  current: number
  total: number
  onSkip: () => void
}

interface MediaFormProps {
  media?: MediaModel
  initialFile?: InitialFile
  queueInfo?: QueueInfo
  onCancel: () => void
  onSaved: (media: MediaModel) => void
  onMarkResolved?: () => void
}

function toInput(media?: MediaModel, initialFile?: InitialFile): MediaInput {
  if (media) {
    return {
      name: media.name,
      type: media.type,
      route: media.route,
      sfw: media.sfw,
      isAiGenerated: media.isAiGenerated,
      artistId: media.artist?.id,
      tagIds: media.tags?.map((tag) => tag.id) ?? [],
      characterIds: media.characters?.map((character) => character.id) ?? [],
      seriesIds: media.series?.map((series) => series.id) ?? []
    }
  }
  return {
    name: initialFile?.name ?? '',
    type: initialFile?.type ?? 'image',
    route: initialFile?.route ?? '',
    sfw: true,
    isAiGenerated: false,
    artistId: undefined,
    tagIds: [],
    characterIds: [],
    seriesIds: []
  }
}

const MISSING_CATEGORIES: { category: SuggestionCategory; labelKey: string }[] = [
  { category: 'artist', labelKey: 'sauceNao.missingArtist' },
  { category: 'tags', labelKey: 'sauceNao.missingTags' },
  { category: 'characters', labelKey: 'sauceNao.missingCharacters' },
  { category: 'series', labelKey: 'sauceNao.missingSeries' }
]

/**
 * WD14 has no category, only a per-tag confidence score - fading
 * lower-confidence chips gives a wall of same-looking tags a scan order
 * without extra chrome (see .wd14-confidence-* in MediaForm.css).
 */
function wd14ConfidenceClass(score: number): string {
  if (score >= 0.6) return 'wd14-confidence-high'
  if (score >= 0.45) return 'wd14-confidence-medium'
  return 'wd14-confidence-low'
}

export function MediaForm({
  media,
  initialFile,
  queueInfo,
  onCancel,
  onSaved,
  onMarkResolved
}: MediaFormProps): JSX.Element {
  const { t } = useTranslation()
  const isEditing = Boolean(media)
  const artists = useArtists()
  const tags = useTags()
  const characters = useCharacters()
  const series = useSeries()

  const [input, setInput] = useState<MediaInput>(() => toInput(media, initialFile))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<MediaDuplicateCheck | null>(null)
  const [pendingTags, setPendingTags] = useState<TagModel[]>([])
  const [pendingSeries, setPendingSeries] = useState<SeriesModel[]>([])
  const [pendingCharacters, setPendingCharacters] = useState<CharacterModel[]>([])
  const [pendingArtists, setPendingArtists] = useState<ArtistModel[]>([])
  const pendingCharacterSeriesIds = useRef(new Map<string, string[]>())
  const pendingArtistSocials = useRef(new Map<string, { name: string; url: string }>())
  const hasSauceNaoApiKey = useSauceNaoApiKey()
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false)

  useEffect((): (() => void) | void => {
    if (!initialFile) return
    let cancelled = false
    window.api.media.checkDuplicate(initialFile.route).then((result) => {
      if (!cancelled && result.success) setDuplicateCheck(result.data)
    })
    return () => {
      cancelled = true
    }
    // Only the initial route matters - ImportQueue mounts a fresh MediaForm
    // instance (via `key`) for every queue item, so this never needs to
    // re-run for the same instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sauce = useSauceNaoSuggestions({
    artists: artists.data,
    tags: tags.data,
    characters: characters.data,
    series: series.data,
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
    tags: tags.data,
    onApplyExisting: (tagIds) => {
      setInput((prev) => ({
        ...prev,
        tagIds: Array.from(new Set([...(prev.tagIds ?? []), ...tagIds]))
      }))
    }
  })

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    const route = (file as File & { path?: string }).path || file.name
    setInput((prev) => ({
      ...prev,
      route,
      type: detectMediaType(file),
      name: deriveMediaName(file.name)
    }))
    sauce.reset()
    wd14.reset()
    setDuplicateCheck(null)
    const result = await window.api.media.checkDuplicate(route)
    if (result.success) setDuplicateCheck(result.data)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value, type, checked } = e.target
    setInput((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleCreateArtist(name: string, social?: { name: string; url: string }): void {
    const draft: ArtistModel = { id: crypto.randomUUID(), name }
    setPendingArtists((prev) => [...prev, draft])
    if (social) pendingArtistSocials.current.set(draft.id, social)
    setInput((prev) => ({ ...prev, artistId: draft.id }))
  }

  function handleCreateTag(name: string): void {
    const tag: TagModel = { id: crypto.randomUUID(), name }
    setPendingTags((prev) => [...prev, tag])
    setInput((prev) => ({ ...prev, tagIds: [...(prev.tagIds ?? []), tag.id] }))
  }

  function handleCreateCharacter(name: string, seriesIds?: string[]): void {
    const draft: CharacterModel = { id: crypto.randomUUID(), name, series: [] }
    setPendingCharacters((prev) => [...prev, draft])
    if (seriesIds && seriesIds.length > 0)
      pendingCharacterSeriesIds.current.set(draft.id, seriesIds)
    setInput((prev) => ({
      ...prev,
      characterIds: [...(prev.characterIds ?? []), draft.id]
    }))
  }

  function handleCreateSeries(name: string): string {
    const draft: SeriesModel = { id: crypto.randomUUID(), name }
    setPendingSeries((prev) => [...prev, draft])
    setInput((prev) => ({ ...prev, seriesIds: [...(prev.seriesIds ?? []), draft.id] }))
    return draft.id
  }

  /**
   * Picking a character that belongs to exactly one series implies that series,
   * so it gets selected automatically. Characters spanning several series stay
   * ambiguous and are left for the user to resolve.
   */
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
   * above). If the match's only series is itself still unconfirmed (a
   * "missing" chip, not yet created), create it now instead of leaving the
   * character unlinked until the user separately clicks that chip too -
   * there's nothing ambiguous to resolve when only one candidate exists.
   */
  async function resolveSeriesIdsForNewCharacter(): Promise<string[]> {
    const current = input.seriesIds ?? []
    if (current.length > 0) return current

    const totalSuggestedSeries =
      (sauce.match?.series.length ?? 0) + (sauce.match?.seriesHints.length ?? 0)
    if (totalSuggestedSeries !== 1 || sauce.missing.series.length !== 1) return current

    const soleSeriesName = sauce.missing.series[0]
    const seriesId = handleCreateSeries(soleSeriesName)
    sauce.dismiss('series', soleSeriesName)
    return [seriesId]
  }

  async function addMissingSuggestion(category: SuggestionCategory, name: string): Promise<void> {
    if (category === 'artist') {
      const artist = sauce.match?.artist
      const social =
        artist?.name === name && artist.socialUrl
          ? { name: artist.socialLabel ?? 'Link', url: artist.socialUrl }
          : undefined
      handleCreateArtist(name, social)
    } else if (category === 'tags') handleCreateTag(name)
    else if (category === 'characters') {
      const seriesIds = await resolveSeriesIdsForNewCharacter()
      handleCreateCharacter(name, seriesIds)
    } else handleCreateSeries(name)
    sauce.dismiss(category, name)
  }

  function addWd14Suggestion(name: string): void {
    handleCreateTag(name)
    wd14.dismiss(name)
  }

  /**
   * If the media ends up tagged with exactly one series, any of its selected
   * characters that aren't already linked to that series in the library get
   * updated to include it - the reverse of the existing "picking a character
   * with exactly one series implies that series" rule, and works regardless
   * of whether the characters/series were picked manually or via a
   * suggestion.
   */
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

  async function resolveInputForSave(overrides?: Partial<MediaInput>): Promise<{
    resolvedInput: MediaInput
    resolvedSeriesIds: string[]
    resolvedCharacterIds: string[]
  }> {
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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (duplicateCheck?.exactMatch) return
    setError(null)
    setSaving(true)

    let resolution: Awaited<ReturnType<typeof resolveInputForSave>>
    try {
      resolution = await resolveInputForSave()
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Failed to save')
      return
    }
    const { resolvedInput, resolvedSeriesIds, resolvedCharacterIds } = resolution

    const result = media
      ? await window.api.media.update(media.id, resolvedInput)
      : await window.api.media.create(resolvedInput)
    setSaving(false)
    if (result.success) {
      if (pendingTags.length > 0) tags.refetch()
      if (pendingArtists.length > 0) artists.refetch()
      if (pendingSeries.length > 0) series.refetch()
      if (pendingCharacters.length > 0) characters.refetch()
      await linkCharactersToSoleSeries(resolvedSeriesIds, resolvedCharacterIds)
      onSaved(result.data)
    } else {
      setError(result.error.message)
    }
  }

  async function handleSendToPending(): Promise<void> {
    if (duplicateCheck?.exactMatch) return
    setError(null)
    setSaving(true)

    let resolution: Awaited<ReturnType<typeof resolveInputForSave>>
    try {
      resolution = await resolveInputForSave({ pendingTagging: true })
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Failed to save')
      return
    }
    const { resolvedInput, resolvedSeriesIds, resolvedCharacterIds } = resolution

    const result = await window.api.media.create(resolvedInput)
    setSaving(false)
    if (result.success) {
      if (pendingTags.length > 0) tags.refetch()
      if (pendingArtists.length > 0) artists.refetch()
      if (pendingSeries.length > 0) series.refetch()
      if (pendingCharacters.length > 0) characters.refetch()
      await linkCharactersToSoleSeries(resolvedSeriesIds, resolvedCharacterIds)
      onSaved(result.data)
    } else {
      setError(result.error.message)
    }
  }

  async function handleMarkResolved(): Promise<void> {
    if (!media || !onMarkResolved) return
    const result = await window.api.media.clearPendingTagging(media.id)
    if (result.success) onMarkResolved()
  }

  const sortedCharacterOptions = sortCharactersByRelevance(
    [...characters.data, ...pendingCharacters],
    input.seriesIds ?? []
  )

  const totalMissingSuggestions =
    MISSING_CATEGORIES.reduce((sum, { category }) => sum + sauce.missing[category].length, 0) +
    wd14.missing.length

  return (
    <div className="media-form">
      <div className="media-page-actions">
        <button type="button" className="btn" onClick={onCancel}>
          <ArrowLeft size={16} />
          {queueInfo ? t('importQueue.close') : t('manage.cancel')}
        </button>
        {media?.pendingTagging && onMarkResolved && (
          <button type="button" className="btn" onClick={handleMarkResolved}>
            {t('media.markResolved')}
          </button>
        )}
      </div>

      <div className="media-form-layout">
        <form className="media-form-card card" onSubmit={handleSubmit}>
          <div className="media-form-group">
            <h2>{t('addMedia.groupFile')}</h2>
            {queueInfo && (
              <p className="import-queue-progress">
                {t('importQueue.progress', { current: queueInfo.current, total: queueInfo.total })}
              </p>
            )}

            {!isEditing && !initialFile && (
              <div className="field">
                <label htmlFor="media-file">{t('addMedia.file')}</label>
                <input
                  id="media-file"
                  type="file"
                  accept="image/*,video/*,.gif"
                  onChange={handleFileChange}
                  required
                />
              </div>
            )}

            {isEditing && media && (
              <div className="media-preview">
                {media.type === 'video' ? (
                  <video muted controls src={toMediaUrl(media.route)} />
                ) : (
                  <img src={toMediaUrl(media.route)} alt={media.name} />
                )}
              </div>
            )}
            {!isEditing && input.route && (
              <div className="media-preview">
                {input.type === 'video' ? (
                  <video muted controls src={toMediaUrl(input.route)} />
                ) : (
                  <img src={toMediaUrl(input.route)} alt="" />
                )}
              </div>
            )}

            {duplicateCheck?.exactMatch && (
              <p role="alert" className="duplicate-error">
                {t('addMedia.duplicateExact', { name: duplicateCheck.exactMatch.name })}
              </p>
            )}
            {!duplicateCheck?.exactMatch && duplicateCheck && duplicateCheck.similar.length > 0 && (
              <div className="duplicate-warning">
                <p>{t('addMedia.duplicateSimilar')}</p>
                <ul className="chip-list">
                  {duplicateCheck.similar.map(({ media: similarMedia, distance }) => (
                    <li key={similarMedia.id}>
                      <MediaHoverPreview media={similarMedia}>
                        {similarMedia.name}
                      </MediaHoverPreview>{' '}
                      ({t('addMedia.duplicateSimilarMatch', { distance })})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="media-form-group">
            <h2>{t('addMedia.groupDetails')}</h2>
            {isEditing && (
              <div className="field">
                <label htmlFor="media-name">{t('manage.name')}</label>
                <input
                  id="media-name"
                  type="text"
                  name="name"
                  value={input.name}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <label className="checkbox-row">
              <input type="checkbox" name="sfw" checked={input.sfw} onChange={handleChange} />
              {t('addMedia.sfw')}
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                name="isAiGenerated"
                checked={input.isAiGenerated}
                onChange={handleChange}
              />
              {t('addMedia.aiGenerated')}
            </label>

            <Autocomplete
              name="artist"
              label={t('filters.artist')}
              options={[...artists.data, ...pendingArtists]}
              getOptionLabel={(artist) =>
                pendingArtists.some((p) => p.id === artist.id)
                  ? t('autocomplete.pendingLabel', { name: artist.name })
                  : artist.name
              }
              getOptionMatchName={(artist) => artist.name}
              getOptionValue={(artist) => artist.id}
              selectedKey={input.artistId ?? null}
              onSelect={(artist) => setInput((prev) => ({ ...prev, artistId: artist?.id }))}
              onCreate={handleCreateArtist}
            />
          </div>

          <div className="media-form-group">
            <h2>{t('addMedia.groupTaxonomy')}</h2>
            <MultiSelectAutocomplete
              name="tags"
              label={t('filters.tags')}
              options={[...tags.data, ...pendingTags]}
              getOptionLabel={(tag) =>
                pendingTags.some((p) => p.id === tag.id)
                  ? t('autocomplete.pendingLabel', { name: tag.name })
                  : tag.name
              }
              getOptionMatchName={(tag) => tag.name}
              getOptionValue={(tag) => tag.id}
              selectedValues={input.tagIds ?? []}
              onChange={(tagIds) => setInput((prev) => ({ ...prev, tagIds }))}
              onCreate={handleCreateTag}
            />
            <MultiSelectAutocomplete
              name="characters"
              label={t('filters.characters')}
              options={sortedCharacterOptions}
              getOptionLabel={(character) =>
                pendingCharacters.some((p) => p.id === character.id)
                  ? t('autocomplete.pendingLabel', { name: formatCharacterOptionLabel(character) })
                  : formatCharacterOptionLabel(character)
              }
              getOptionMatchName={(character) => character.name}
              getOptionValue={(character) => character.id}
              selectedValues={input.characterIds ?? []}
              onChange={handleCharactersChange}
              onCreate={handleCreateCharacter}
            />
            <MultiSelectAutocomplete
              name="series"
              label={t('manage.series')}
              options={[...series.data, ...pendingSeries]}
              getOptionLabel={(s) =>
                pendingSeries.some((p) => p.id === s.id)
                  ? t('autocomplete.pendingLabel', { name: s.name })
                  : s.name
              }
              getOptionMatchName={(s) => s.name}
              getOptionValue={(s) => s.id}
              selectedValues={input.seriesIds ?? []}
              onChange={(seriesIds) => setInput((prev) => ({ ...prev, seriesIds }))}
              onCreate={handleCreateSeries}
            />
          </div>

          {error && <p role="alert">{error}</p>}

          <div className="media-form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || Boolean(duplicateCheck?.exactMatch)}
            >
              {saving
                ? t('media.saving')
                : queueInfo
                  ? t('importQueue.saveAndNext')
                  : isEditing
                    ? t('manage.save')
                    : t('addMedia.submit')}
            </button>
            {queueInfo && (
              <button type="button" className="btn" onClick={queueInfo.onSkip}>
                {t('importQueue.skip')}
              </button>
            )}
            {queueInfo && !media && (
              <button type="button" className="btn" onClick={handleSendToPending} disabled={saving}>
                {t('importQueue.sendToPending')}
              </button>
            )}
          </div>
        </form>

        <aside className={`suggestions-rail${suggestionsCollapsed ? ' is-collapsed' : ''}`}>
          <button
            type="button"
            className="suggestions-rail-toggle"
            onClick={() => setSuggestionsCollapsed((prev) => !prev)}
            aria-expanded={!suggestionsCollapsed}
            aria-label={t(
              suggestionsCollapsed ? 'addMedia.suggestionsExpand' : 'addMedia.suggestionsCollapse'
            )}
          >
            {suggestionsCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            <span className="suggestions-rail-toggle-label">{t('addMedia.suggestionsTitle')}</span>
            {suggestionsCollapsed && totalMissingSuggestions > 0 && (
              <span className="suggestions-rail-badge">{totalMissingSuggestions}</span>
            )}
          </button>

          {!suggestionsCollapsed && (
            <div className="suggestions-rail-body">
              <div className="suggestions-rail-section">
                <span className="suggestions-rail-section-title">
                  {t('addMedia.suggestionsSauceNaoTitle')}
                </span>
                {hasSauceNaoApiKey ? (
                  <div className="sauce-panel">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => sauce.run(input.route)}
                      disabled={!input.route || saving || sauce.status === 'loading'}
                    >
                      <ScanSearch size={16} />
                      {sauce.status === 'loading' ? t('sauceNao.searching') : t('sauceNao.button')}
                    </button>
                    <p className="sauce-hint">{t('sauceNao.privacyHint')}</p>
                    {input.type === 'video' && (
                      <p className="sauce-hint">{t('sauceNao.videoHint')}</p>
                    )}

                    {sauce.status === 'error' && (
                      <p role="alert" className="sauce-error">
                        {sauce.error}
                      </p>
                    )}

                    {sauce.status === 'ready' && !sauce.match && (
                      <>
                        <p className="sauce-hint">{t('sauceNao.noMatch')}</p>
                        {sauce.remaining && (
                          <p className="sauce-quota">
                            {t('sauceNao.quota', { count: sauce.remaining.long })}
                          </p>
                        )}
                      </>
                    )}

                    {sauce.match && (
                      <>
                        <div className="sauce-result-head">
                          <span className="badge badge-accent">
                            {t('sauceNao.similarity', {
                              value: Math.round(sauce.match.similarity)
                            })}
                          </span>
                          <span>{sauce.match.indexName}</span>
                          {sauce.match.sourceUrl && (
                            <a href={sauce.match.sourceUrl} target="_blank" rel="noreferrer">
                              <ExternalLink size={12} />
                              {t('sauceNao.viewSource')}
                            </a>
                          )}
                          {sauce.remaining && (
                            <span className="sauce-quota">
                              {t('sauceNao.quota', { count: sauce.remaining.long })}
                            </span>
                          )}
                          <button type="button" className="btn" onClick={sauce.reset}>
                            {t('sauceNao.dismiss')}
                          </button>
                        </div>
                        <p className="sauce-hint">
                          {t('sauceNao.applied', { count: sauce.appliedCount })}
                        </p>

                        {MISSING_CATEGORIES.map(
                          ({ category, labelKey }) =>
                            sauce.missing[category].length > 0 && (
                              <div className="sauce-missing-row" key={category}>
                                <span className="sauce-cat-label">{t(labelKey)}</span>
                                <ul className={`chip-list chip-list-${category}`}>
                                  {sauce.missing[category].map((name) => (
                                    <li key={name}>
                                      <button
                                        type="button"
                                        className="sauce-add-chip"
                                        onClick={() => addMissingSuggestion(category, name)}
                                      >
                                        <Plus size={12} />
                                        {name}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="sauce-hint">
                    {t('sauceNao.noApiKeyHint')}{' '}
                    <Link to={PATH.SETTINGS}>{t('sauceNao.noApiKeyHintLink')}</Link>
                  </p>
                )}
              </div>

              <div className="suggestions-rail-section">
                <span className="suggestions-rail-section-title">
                  {t('addMedia.suggestionsWd14Title')}
                </span>
                {wd14Runtime.status === 'installed' ? (
                  <div className="sauce-panel">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => wd14.run(input.route)}
                      disabled={!input.route || saving || wd14.status === 'loading'}
                    >
                      <Cpu size={16} />
                      {wd14.status === 'loading' ? t('wd14.searching') : t('wd14.button')}
                    </button>
                    <p className="sauce-hint">{t('wd14.privacyHint')}</p>

                    {wd14.status === 'error' && (
                      <p role="alert" className="sauce-error">
                        {wd14.error}
                      </p>
                    )}

                    {wd14.status === 'ready' &&
                      (wd14.appliedCount === 0 && wd14.missing.length === 0 ? (
                        <p className="sauce-hint">{t('wd14.noSuggestions')}</p>
                      ) : (
                        <>
                          <div className="sauce-result-head">
                            <span>{t('wd14.applied', { count: wd14.appliedCount })}</span>
                            <button type="button" className="btn" onClick={wd14.reset}>
                              {t('wd14.dismiss')}
                            </button>
                          </div>
                          {wd14.missing.length > 0 && (
                            <ul className="chip-list chip-list-tags">
                              {wd14.missing.map(({ name, score }) => (
                                <li
                                  key={name}
                                  className={`wd14-missing-chip ${wd14ConfidenceClass(score)}`}
                                >
                                  <button
                                    type="button"
                                    className="sauce-add-chip"
                                    onClick={() => addWd14Suggestion(name)}
                                  >
                                    <Plus size={12} />
                                    {name}
                                  </button>
                                  <TagWikiInfo tagName={name} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ))}
                  </div>
                ) : (
                  <p className="sauce-hint">
                    {t('wd14.notInstalledHint')}{' '}
                    <Link to={PATH.SETTINGS}>{t('wd14.notInstalledHintLink')}</Link>
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
