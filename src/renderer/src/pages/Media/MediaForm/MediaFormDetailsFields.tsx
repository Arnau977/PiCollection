import { useTranslation } from 'react-i18next'
import { ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react'
import type { ArtistModel, MediaInput } from '@shared/models'
import { Autocomplete } from '../../../components/Autocomplete/Autocomplete'

interface MediaFormDetailsFieldsProps {
  isEditing: boolean
  hideNames: boolean
  input: MediaInput
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  artistOptions: ArtistModel[]
  pendingArtists: ArtistModel[]
  onArtistSelect: (artist: ArtistModel | null) => void
  onCreateArtist: (name: string, social?: { name: string; url: string }) => void
}

export function MediaFormDetailsFields({
  isEditing,
  hideNames,
  input,
  onChange,
  artistOptions,
  pendingArtists,
  onArtistSelect,
  onCreateArtist
}: MediaFormDetailsFieldsProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="media-form-group">
      <h2>{t('addMedia.groupDetails')}</h2>
      {isEditing && !hideNames && (
        <div className="field">
          <label htmlFor="media-name">{t('manage.name')}</label>
          <input
            id="media-name"
            type="text"
            name="name"
            value={input.name}
            onChange={onChange}
            required
          />
        </div>
      )}

      <div className="media-form-toggles">
        <label
          className="media-form-toggle"
          title={input.sfw ? t('media.sfwTitle') : t('media.nsfwTitle')}
        >
          <input
            type="checkbox"
            className="media-form-toggle-input"
            name="sfw"
            checked={input.sfw}
            onChange={onChange}
            aria-label={input.sfw ? t('media.sfwTitle') : t('media.nsfwTitle')}
          />
          <span className="media-form-toggle-track" aria-hidden="true">
            <span className="media-form-toggle-option media-form-toggle-option-on">
              <ShieldCheck size={14} />
              {t('media.sfwBadge')}
            </span>
            <span className="media-form-toggle-option media-form-toggle-option-off">
              <ShieldAlert size={14} />
              {t('media.nsfwBadge')}
            </span>
          </span>
        </label>

        <label className="media-form-toggle" title={t('media.aiGeneratedTitle')}>
          <input
            type="checkbox"
            className="media-form-toggle-input"
            name="isAiGenerated"
            checked={input.isAiGenerated}
            onChange={onChange}
            aria-label={t('media.aiGeneratedTitle')}
          />
          <span className="media-form-toggle-track" aria-hidden="true">
            <span className="media-form-toggle-option media-form-toggle-option-on">
              <Sparkles size={14} />
              {t('media.aiGeneratedBadge')}
            </span>
          </span>
        </label>
      </div>

      <div className="field-accent field-accent-artist">
        <Autocomplete
          name="artist"
          label={t('filters.artist')}
          options={artistOptions}
          getOptionLabel={(artist) =>
            pendingArtists.some((p) => p.id === artist.id)
              ? t('autocomplete.pendingLabel', { name: artist.name })
              : artist.name
          }
          getOptionMatchName={(artist) => artist.name}
          getOptionValue={(artist) => artist.id}
          selectedKey={input.artistId ?? null}
          onSelect={onArtistSelect}
          onCreate={onCreateArtist}
        />
      </div>
    </div>
  )
}
