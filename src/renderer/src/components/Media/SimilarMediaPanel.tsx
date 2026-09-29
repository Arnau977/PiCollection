import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Columns2 } from 'lucide-react'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { PATH } from '../../app.routes.const'
import { useSimilarMedia } from '../../hooks/useSimilarMedia'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import { MediaThumb } from '../MediaThumb/MediaThumb'
import { MediaCompare, type ComparedMedia } from '../MediaCompare/MediaCompare'
import './SimilarMediaPanel.css'

type ShownMedia = Pick<MediaModel, 'id' | 'route' | 'name' | 'type' | 'pendingTagging'>

interface SimilarMediaPanelProps {
  /** The media whose detail page this is - also the left side of a comparison. */
  media: ShownMedia
}

const statusOf = (media: ShownMedia): ComparedMedia['status'] =>
  media.pendingTagging ? 'pending' : 'library'

export function SimilarMediaPanel({ media: current }: SimilarMediaPanelProps): JSX.Element | null {
  const { t } = useTranslation()
  const { data } = useSimilarMedia(current.id)
  const { defaults } = useGalleryDefaults()
  const [compared, setCompared] = useState<ComparedMedia | null>(null)

  if (data.length === 0) return null

  return (
    <div className="media-detail-section">
      <h2>{t('media.similarMedia')}</h2>
      <ul className="similar-media-grid">
        {data.map(({ media }) => {
          const blurred = defaults.blurNsfw && !media.sfw
          return (
            <li key={media.id}>
              <Link
                to={PATH.MEDIA.replace(':id', media.id)}
                className="similar-media-link"
                aria-label={media.name}
              >
                <div
                  className={
                    blurred ? 'similar-media-thumb-wrap nsfw-blur' : 'similar-media-thumb-wrap'
                  }
                >
                  <MediaThumb type={media.type} route={media.route} alt={media.name} />
                  {blurred && <span className="nsfw-blur-overlay">{t('media.revealNsfw')}</span>}
                </div>
              </Link>
              {/* A still frame can't be slid against a playing video. */}
              {current.type !== 'video' && media.type !== 'video' && (
                <button
                  type="button"
                  className="similar-media-compare"
                  aria-label={t('mediaCompare.openLabel', { name: media.name })}
                  title={t('mediaCompare.openLabel', { name: media.name })}
                  onClick={() =>
                    setCompared({
                      src: toMediaUrl(media.route),
                      name: media.name,
                      status: statusOf(media)
                    })
                  }
                >
                  <Columns2 size={14} />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {compared && (
        <MediaCompare
          left={{ src: toMediaUrl(current.route), name: current.name, status: statusOf(current) }}
          right={compared}
          onClose={() => setCompared(null)}
        />
      )}
    </div>
  )
}
