import { useState } from 'react'
import { ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { useSeries } from '../hooks/useEntityLists'
import { buildAncestorAwareSeriesTree } from '../utils/buildSeriesTree'
import { Lightbox } from './Lightbox/Lightbox'
import './Media.css'

interface MediaProps extends MediaModel {
  /** Sibling ids in the current gallery order, for the left/right click zones. Omitted (or both
   * null) outside the detail page - e.g. nothing renders the zones without navigation to do. */
  previousId?: string | null
  nextId?: string | null
  onNavigate?: (id: string) => void
}

export default function Media({
  tags = [],
  sfw,
  isAiGenerated,
  name,
  characters = [],
  series = [],
  type,
  artist,
  route,
  previousId = null,
  nextId = null,
  onNavigate
}: MediaProps): JSX.Element {
  const { t } = useTranslation()
  const mediaUrl = toMediaUrl(route)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const { data: allSeries } = useSeries()
  const seriesTree = buildAncestorAwareSeriesTree(series, allSeries)
  // Video already owns its own click surface (native transport controls), so the
  // prev/next zones only overlay stills - a video keeps the old open-lightbox-anywhere behavior.
  const showNavZones = onNavigate && type !== 'video'

  return (
    <div className="media-detail">
      <div className="media-detail-media">
        {(type === 'image' || type === 'gif') && (
          <img src={mediaUrl} alt={name} onClick={() => setLightboxOpen(true)} />
        )}
        {type === 'video' && (
          <video controls src={mediaUrl} onClick={() => setLightboxOpen(true)}>
            Your browser does not support the video tag.
          </video>
        )}
        {showNavZones && previousId && (
          <button
            type="button"
            className="media-detail-nav media-detail-nav-prev"
            aria-label={t('media.previousImage')}
            title={t('media.previousImage')}
            onClick={() => onNavigate(previousId)}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {showNavZones && nextId && (
          <button
            type="button"
            className="media-detail-nav media-detail-nav-next"
            aria-label={t('media.nextImage')}
            title={t('media.nextImage')}
            onClick={() => onNavigate(nextId)}
          >
            <ChevronRight size={22} />
          </button>
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

        <div className="media-detail-section">
          <h2>{t('filters.artist')}</h2>
          <p className="media-detail-name media-detail-name-artist">
            {artist?.name ?? t('media.unknownArtist')}
          </p>
        </div>

        {series.length > 0 && (
          <div className="media-detail-section">
            <h2>{t('manage.series')}</h2>
            <ul className="media-detail-list media-detail-list-series">
              {seriesTree.map((node) => (
                <li
                  key={node.series.id}
                  className="media-detail-name-series"
                  style={node.depth > 0 ? { marginLeft: node.depth * 16 } : undefined}
                >
                  {node.depth > 0 && (
                    <span className="media-detail-tree-connector" aria-hidden="true">
                      └
                    </span>
                  )}
                  {node.series.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {characters.length > 0 && (
          <div className="media-detail-section">
            <h2>{t('filters.characters')}</h2>
            <ul className="media-detail-list media-detail-list-characters">
              {characters.map((character) => (
                <li key={character.id} className="media-detail-name-character">
                  {character.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tags.length > 0 && (
          <div className="media-detail-section">
            <h2>{t('filters.tags')}</h2>
            <ul className="chip-list chip-list-tags">
              {tags.map((tag) => (
                <li key={tag.id}>{tag.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
