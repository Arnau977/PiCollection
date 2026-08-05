import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Plus, ScanSearch } from 'lucide-react'
import type { CharacterModel, MediaDuplicateCheck, MediaInput, MediaModel } from '@shared/models'
import { deriveMediaName, detectMediaType } from '@shared/utils'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { Autocomplete } from '../../components/Autocomplete/Autocomplete'
import { MultiSelectAutocomplete } from '../../components/Autocomplete/MultiSelectAutocomplete'
import { PATH } from '../../app.routes.const'
import { useArtists, useCharacters, useSeries, useTags } from '../../hooks/useEntityLists'
import { useSauceNaoApiKey } from '../../hooks/useSauceNaoApiKey'
import { useSauceNaoSuggestions, type SuggestionCategory } from '../../hooks/useSauceNaoSuggestions'
import { formatCharacterOptionLabel } from '../../utils/matchEntityNames'
import { withImpliedSeries } from '../../utils/withImpliedSeries'
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

export function MediaForm({
  media,
  initialFile,
  queueInfo,
  onCancel,
  onSaved
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
  const hasSauceNaoApiKey = useSauceNaoApiKey()

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
    setDuplicateCheck(null)
    const result = await window.api.media.checkDuplicate(route)
    if (result.success) setDuplicateCheck(result.data)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value, type, checked } = e.target
    setInput((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleCreateArtist(
    name: string,
    social?: { name: string; url: string }
  ): Promise<void> {
    const result = await window.api.artist.create({ name })
    if (result.success) {
      artists.refetch()
      setInput((prev) => ({ ...prev, artistId: result.data.id }))
      if (social) await window.api.artist.addSocialLink(result.data.id, social)
    } else {
      setError(result.error.message)
    }
  }

  async function handleCreateTag(name: string): Promise<void> {
    const result = await window.api.tag.create({ name })
    if (result.success) {
      tags.refetch()
      setInput((prev) => ({ ...prev, tagIds: [...(prev.tagIds ?? []), result.data.id] }))
    } else {
      setError(result.error.message)
    }
  }

  async function handleCreateCharacter(name: string, seriesIds?: string[]): Promise<void> {
    const result = await window.api.character.create({ name, seriesIds })
    if (result.success) {
      characters.refetch()
      setInput((prev) => ({
        ...prev,
        characterIds: [...(prev.characterIds ?? []), result.data.id]
      }))
    } else {
      setError(result.error.message)
    }
  }

  async function handleCreateSeries(name: string): Promise<string | undefined> {
    const result = await window.api.series.create({ name })
    if (result.success) {
      series.refetch()
      setInput((prev) => ({ ...prev, seriesIds: [...(prev.seriesIds ?? []), result.data.id] }))
      return result.data.id
    }
    setError(result.error.message)
    return undefined
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
    const seriesId = await handleCreateSeries(soleSeriesName)
    if (!seriesId) return current
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
      await handleCreateArtist(name, social)
    } else if (category === 'tags') await handleCreateTag(name)
    else if (category === 'characters') {
      const seriesIds = await resolveSeriesIdsForNewCharacter()
      await handleCreateCharacter(name, seriesIds)
    } else await handleCreateSeries(name)
    sauce.dismiss(category, name)
  }

  /**
   * If the media ends up tagged with exactly one series, any of its selected
   * characters that aren't already linked to that series in the library get
   * updated to include it - the reverse of the existing "picking a character
   * with exactly one series implies that series" rule, and works regardless
   * of whether the characters/series were picked manually or via a
   * suggestion.
   */
  async function linkCharactersToSoleSeries(): Promise<void> {
    const seriesIds = input.seriesIds ?? []
    if (seriesIds.length !== 1) return
    const [soleSeriesId] = seriesIds

    const toUpdate = (input.characterIds ?? [])
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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (duplicateCheck?.exactMatch) return
    setError(null)
    setSaving(true)
    const result = media
      ? await window.api.media.update(media.id, input)
      : await window.api.media.create(input)
    setSaving(false)
    if (result.success) {
      await linkCharactersToSoleSeries()
      onSaved(result.data)
    } else {
      setError(result.error.message)
    }
  }

  return (
    <div className="media-form">
      <div className="media-page-actions">
        <button type="button" className="btn" onClick={onCancel}>
          <ArrowLeft size={16} />
          {queueInfo ? t('importQueue.close') : t('manage.cancel')}
        </button>
      </div>

      <form className="media-form-card card" onSubmit={handleSubmit}>
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
                  {similarMedia.name} ({t('addMedia.duplicateSimilarMatch', { distance })})
                </li>
              ))}
            </ul>
          </div>
        )}

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
            {input.type === 'video' && <p className="sauce-hint">{t('sauceNao.videoHint')}</p>}

            {sauce.status === 'error' && (
              <p role="alert" className="sauce-error">
                {sauce.error}
              </p>
            )}

            {sauce.status === 'ready' && !sauce.match && (
              <p className="sauce-hint">{t('sauceNao.noMatch')}</p>
            )}

            {sauce.match && (
              <>
                <div className="sauce-result-head">
                  <span className="badge badge-accent">
                    {t('sauceNao.similarity', { value: Math.round(sauce.match.similarity) })}
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
                <p className="sauce-hint">{t('sauceNao.applied', { count: sauce.appliedCount })}</p>

                {MISSING_CATEGORIES.map(
                  ({ category, labelKey }) =>
                    sauce.missing[category].length > 0 && (
                      <div className="sauce-missing-row" key={category}>
                        <span className="sauce-cat-label">{t(labelKey)}</span>
                        <ul className="chip-list">
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
          options={artists.data}
          getOptionLabel={(artist) => artist.name}
          getOptionValue={(artist) => artist.id}
          selectedKey={input.artistId ?? null}
          onSelect={(artist) => setInput((prev) => ({ ...prev, artistId: artist?.id }))}
          onCreate={handleCreateArtist}
        />
        <MultiSelectAutocomplete
          name="tags"
          label={t('filters.tags')}
          options={tags.data}
          getOptionLabel={(tag) => tag.name}
          getOptionValue={(tag) => tag.id}
          selectedValues={input.tagIds ?? []}
          onChange={(tagIds) => setInput((prev) => ({ ...prev, tagIds }))}
          onCreate={handleCreateTag}
        />
        <MultiSelectAutocomplete
          name="characters"
          label={t('filters.characters')}
          options={characters.data}
          getOptionLabel={formatCharacterOptionLabel}
          getOptionMatchName={(character) => character.name}
          getOptionValue={(character) => character.id}
          selectedValues={input.characterIds ?? []}
          onChange={handleCharactersChange}
          onCreate={handleCreateCharacter}
        />
        <MultiSelectAutocomplete
          name="series"
          label={t('manage.series')}
          options={series.data}
          getOptionLabel={(s) => s.name}
          getOptionValue={(s) => s.id}
          selectedValues={input.seriesIds ?? []}
          onChange={(seriesIds) => setInput((prev) => ({ ...prev, seriesIds }))}
          onCreate={handleCreateSeries}
        />

        {error && <p role="alert">{error}</p>}

        <div className="media-form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || Boolean(duplicateCheck?.exactMatch)}
          >
            {queueInfo
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
        </div>
      </form>
    </div>
  )
}
