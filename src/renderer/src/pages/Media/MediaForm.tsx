import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import type { MediaInput, MediaModel } from '@shared/models'
import { deriveMediaName, detectMediaType } from '@shared/utils'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { Autocomplete } from '../../components/Autocomplete/Autocomplete'
import { MultiSelectAutocomplete } from '../../components/Autocomplete/MultiSelectAutocomplete'
import { useArtists, useCharacters, useSeries, useTags } from '../../hooks/useEntityLists'
import './MediaForm.css'

interface MediaFormProps {
  media?: MediaModel
  onCancel: () => void
  onSaved: (media: MediaModel) => void
}

function toInput(media?: MediaModel): MediaInput {
  if (!media) {
    return {
      name: '',
      type: 'image',
      route: '',
      sfw: true,
      isAiGenerated: false,
      artistId: undefined,
      tagIds: [],
      characterIds: [],
      seriesIds: []
    }
  }
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

export function MediaForm({ media, onCancel, onSaved }: MediaFormProps): JSX.Element {
  const { t } = useTranslation()
  const isEditing = Boolean(media)
  const artists = useArtists()
  const tags = useTags()
  const characters = useCharacters()
  const series = useSeries()

  const [input, setInput] = useState<MediaInput>(() => toInput(media))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const route = (file as File & { path?: string }).path || file.name
    setInput((prev) => ({
      ...prev,
      route,
      type: detectMediaType(file),
      name: deriveMediaName(file.name)
    }))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value, type, checked } = e.target
    setInput((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleCreateArtist(name: string): Promise<void> {
    const result = await window.api.artist.create({ name })
    if (result.success) {
      artists.refetch()
      setInput((prev) => ({ ...prev, artistId: result.data.id }))
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

  async function handleCreateCharacter(name: string): Promise<void> {
    const result = await window.api.character.create({ name })
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

  async function handleCreateSeries(name: string): Promise<void> {
    const result = await window.api.series.create({ name })
    if (result.success) {
      series.refetch()
      setInput((prev) => ({ ...prev, seriesIds: [...(prev.seriesIds ?? []), result.data.id] }))
    } else {
      setError(result.error.message)
    }
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
      const seriesIds = [...(prev.seriesIds ?? [])]

      for (const characterId of added) {
        const character = characters.data.find((candidate) => candidate.id === characterId)
        const onlySeries = character?.series.length === 1 ? character.series[0] : undefined
        if (onlySeries && !seriesIds.includes(onlySeries.id)) {
          seriesIds.push(onlySeries.id)
        }
      }

      return { ...prev, characterIds, seriesIds }
    })
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const result = media
      ? await window.api.media.update(media.id, input)
      : await window.api.media.create(input)
    setSaving(false)
    if (result.success) {
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
          {t('manage.cancel')}
        </button>
      </div>

      <form className="media-form-card card" onSubmit={handleSubmit}>
        {!isEditing && (
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
          getOptionLabel={(character) => character.name}
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
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {isEditing ? t('manage.save') : t('addMedia.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
