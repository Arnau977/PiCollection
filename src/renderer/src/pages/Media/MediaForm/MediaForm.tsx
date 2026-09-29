import { useEffect, useState } from 'react'
import type { MediaDuplicateCheck, MediaInput, MediaModel } from '@shared/models'
import { deriveMediaName, detectMediaType } from '@shared/utils'
import { useArtists, useCharacters, useSeries, useTags } from '../../../hooks/useEntityLists'
import { useGalleryDefaults } from '../../../hooks/useGalleryDefaults'
import { sortCharactersByRelevance } from '../../../utils/sortCharactersBySeries'
import { MediaFormDetailsFields } from './MediaFormDetailsFields'
import { MediaFormFileGroup } from './MediaFormFileGroup'
import { MediaFormTaxonomyFields } from './MediaFormTaxonomyFields'
import { MediaFormTopActions } from './MediaFormTopActions'
import type { InitialFile, QueueInfo } from './MediaForm.types'
import { SuggestionsRail } from './SuggestionsRail'
import { useMediaFormDrafts } from './useMediaFormDrafts'
import { useMediaFormSuggestions } from './useMediaFormSuggestions'
import './MediaForm.css'

export type { InitialFile, QueueInfo }

interface MediaFormProps {
  media?: MediaModel
  initialFile?: InitialFile
  queueInfo?: QueueInfo
  onCancel: () => void
  onSaved: (media: MediaModel) => void
  onSentToPending?: (media: MediaModel) => void
  onMarkResolved?: () => void
  /** Removes the media from the app (never the file on disk); pending media only. */
  onDelete?: () => void
  deleting?: boolean
}

function toInput(media?: MediaModel, initialFile?: InitialFile): MediaInput {
  if (media) {
    return {
      name: media.name,
      type: media.type,
      route: media.route,
      sourceUrl: media.sourceUrl,
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

export function MediaForm({
  media,
  initialFile,
  queueInfo,
  onCancel,
  onSaved,
  onSentToPending,
  onMarkResolved,
  onDelete,
  deleting
}: MediaFormProps): JSX.Element {
  const isEditing = Boolean(media)
  const artists = useArtists()
  const tags = useTags()
  const characters = useCharacters()
  const series = useSeries()
  const { defaults: galleryDefaults } = useGalleryDefaults()

  const [input, setInput] = useState<MediaInput>(() => toInput(media, initialFile))
  // In a queue, "Guardar" no longer advances to the next item - it just
  // persists the current one and stays put, so a second "Guardar" click (or
  // one from the queue's "Siguiente" bookkeeping) must update that same
  // record instead of creating a duplicate. Only relevant for brand-new
  // media (`media` is unset); an existing record already has its own id.
  const [queueSavedMedia, setQueueSavedMedia] = useState<MediaModel | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<MediaDuplicateCheck | null>(null)

  const drafts = useMediaFormDrafts({ input, setInput, artists, tags, characters, series })
  const suggestions = useMediaFormSuggestions({
    input,
    setInput,
    artists,
    tags,
    characters,
    series,
    drafts,
    sourceMetadata: media?.sourceMetadata
  })

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
    suggestions.sauce.reset()
    suggestions.wd14.reset()
    setDuplicateCheck(null)
    const result = await window.api.media.checkDuplicate(route)
    if (result.success) setDuplicateCheck(result.data)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value, type, checked } = e.target
    setInput((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  /** Persists the form as-is; null (with the error shown) when that failed. */
  async function saveForm(): Promise<MediaModel | null> {
    setError(null)
    setSaving(true)

    let resolution: Awaited<ReturnType<typeof drafts.resolveForSave>>
    try {
      resolution = await drafts.resolveForSave()
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Failed to save')
      return null
    }
    const { resolvedInput, resolvedSeriesIds, resolvedCharacterIds } = resolution

    const existingMedia = media ?? queueSavedMedia
    const result = existingMedia
      ? await window.api.media.update(existingMedia.id, resolvedInput)
      : await window.api.media.create(resolvedInput)
    setSaving(false)
    if (!result.success) {
      setError(result.error.message)
      return null
    }
    drafts.refetchCreated()
    if (!result.data.pendingTagging)
      await suggestions.linkCharactersToSoleSeries(resolvedSeriesIds, resolvedCharacterIds)
    if (!media) setQueueSavedMedia(result.data)
    return result.data
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (duplicateCheck?.exactMatch) return
    const saved = await saveForm()
    if (saved) onSaved(saved)
  }

  async function handleSendToPending(): Promise<void> {
    if (duplicateCheck?.exactMatch) return
    setError(null)
    setSaving(true)

    let resolution: Awaited<ReturnType<typeof drafts.resolveForSave>>
    try {
      resolution = await drafts.resolveForSave({ pendingTagging: true })
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Failed to save')
      return
    }
    // Character/series links wait until the media is marked resolved.
    const result = await window.api.media.create(resolution.resolvedInput)
    setSaving(false)
    if (result.success) {
      drafts.refetchCreated()
      ;(onSentToPending ?? onSaved)(result.data)
    } else {
      setError(result.error.message)
    }
  }

  // Resolving used to only clear the pending flag, silently dropping whatever
  // was tagged in the form but not saved first - so it saves, then resolves.
  // A failed save stops here with the form (and its error) still on screen.
  async function handleMarkResolved(): Promise<void> {
    if (!media || !onMarkResolved) return
    const saved = await saveForm()
    if (!saved) return
    setSaving(true)
    const result = await window.api.media.clearPendingTagging(media.id)
    setSaving(false)
    if (result.success) onMarkResolved()
    else setError(result.error.message)
  }

  const sortedCharacterOptions = sortCharactersByRelevance(
    [...characters.data, ...drafts.pendingCharacters],
    input.seriesIds ?? []
  )

  return (
    <div className="media-form">
      <MediaFormTopActions
        media={media}
        queueInfo={queueInfo}
        queueSavedMedia={queueSavedMedia}
        isEditing={isEditing}
        saving={saving}
        deleting={deleting}
        hasExactDuplicate={Boolean(duplicateCheck?.exactMatch)}
        onCancel={onCancel}
        onMarkResolved={onMarkResolved}
        onMarkResolvedClick={handleMarkResolved}
        onSendToPending={handleSendToPending}
        onDelete={onDelete}
      />

      <div className="media-form-scroll-region">
        <div className="media-form-layout">
          <form id="media-form" className="media-form-card card" onSubmit={handleSubmit}>
            <MediaFormFileGroup
              queueInfo={queueInfo}
              isEditing={isEditing}
              initialFile={initialFile}
              media={media}
              input={input}
              duplicateCheck={duplicateCheck}
              onFileChange={handleFileChange}
            />

            <MediaFormDetailsFields
              isEditing={isEditing}
              hideNames={galleryDefaults.hideNames}
              input={input}
              onChange={handleChange}
              artistOptions={[...artists.data, ...drafts.pendingArtists]}
              pendingArtists={drafts.pendingArtists}
              onArtistSelect={(artist) => setInput((prev) => ({ ...prev, artistId: artist?.id }))}
              onCreateArtist={drafts.createArtist}
            />

            <MediaFormTaxonomyFields
              tagOptions={[...tags.data, ...drafts.pendingTags]}
              pendingTags={drafts.pendingTags}
              selectedTagIds={input.tagIds ?? []}
              onTagsChange={(tagIds) => setInput((prev) => ({ ...prev, tagIds }))}
              onCreateTag={drafts.createTag}
              characterOptions={sortedCharacterOptions}
              pendingCharacters={drafts.pendingCharacters}
              selectedCharacterIds={input.characterIds ?? []}
              onCharactersChange={suggestions.handleCharactersChange}
              onCreateCharacter={(name) => drafts.createCharacter(name)}
              seriesOptions={[...series.data, ...drafts.pendingSeries]}
              pendingSeries={drafts.pendingSeries}
              selectedSeriesIds={input.seriesIds ?? []}
              onSeriesChange={(seriesIds) => setInput((prev) => ({ ...prev, seriesIds }))}
              onCreateSeries={drafts.createSeries}
            />

            {error && <p role="alert">{error}</p>}
          </form>

          <SuggestionsRail
            suggestions={suggestions}
            input={input}
            saving={saving}
            onApplyRating={(sfw) => setInput((prev) => ({ ...prev, sfw }))}
            onApplySourceUrl={(sourceUrl) => setInput((prev) => ({ ...prev, sourceUrl }))}
          />
        </div>
      </div>
    </div>
  )
}
