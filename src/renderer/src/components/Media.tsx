import { useState } from 'react'
import { ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { Lightbox } from './Lightbox/Lightbox'
import './Media.css'

export default function Media({
  tags = [],
  sfw,
  isAiGenerated,
  name,
  characters = [],
  series = [],
  type,
  artist,
  route
}: MediaModel): JSX.Element {
  const { t } = useTranslation()
  const mediaUrl = toMediaUrl(route)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <div className="media-detail">
      <div className="media-detail-media" onClick={() => setLightboxOpen(true)}>
        {(type === 'image' || type === 'gif') && <img src={mediaUrl} alt={name} />}
        {type === 'video' && (
          <video controls src={mediaUrl}>
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {lightboxOpen && (
        <Lightbox
          src={mediaUrl}
          type={type}
          alt={name}
          route={route}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className="media-detail-info">
        <div className="media-detail-header">
          <h1>{name}</h1>
          <div className="media-detail-badges">
            {sfw ? (
              <span className="badge badge-success" title={t('media.sfwTitle')}>
                <ShieldCheck size={14} />
                {t('media.sfwBadge')}
              </span>
            ) : (
              <span className="badge badge-danger" title={t('media.nsfwTitle')}>
                <ShieldAlert size={14} />
                {t('media.nsfwBadge')}
              </span>
            )}
            {isAiGenerated && (
              <span className="badge badge-accent" title={t('media.aiGeneratedTitle')}>
                <Sparkles size={14} />
                {t('media.aiGeneratedBadge')}
              </span>
            )}
          </div>
        </div>

        <p className="media-detail-artist">
          {t('media.artistLabel', { name: artist?.name ?? t('media.unknownArtist') })}
        </p>

        {tags.length > 0 && (
          <div className="media-detail-section">
            <h2>{t('filters.tags')}</h2>
            <ul className="chip-list">
              {tags.map((tag) => (
                <li key={tag.id}>{tag.name}</li>
              ))}
            </ul>
          </div>
        )}

        {characters.length > 0 && (
          <div className="media-detail-section">
            <h2>{t('filters.characters')}</h2>
            <ul className="chip-list">
              {characters.map((character) => (
                <li key={character.id}>{character.name}</li>
              ))}
            </ul>
          </div>
        )}

        {series.length > 0 && (
          <div className="media-detail-section">
            <h2>{t('manage.series')}</h2>
            <ul className="chip-list">
              {series.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
