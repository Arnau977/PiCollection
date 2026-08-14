import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '../../app.routes.const'
import { useSimilarMedia } from '../../hooks/useSimilarMedia'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import { MediaThumb } from '../MediaThumb/MediaThumb'
import './SimilarMediaPanel.css'

interface SimilarMediaPanelProps {
  mediaId: string
}

export function SimilarMediaPanel({ mediaId }: SimilarMediaPanelProps): JSX.Element | null {
  const { t } = useTranslation()
  const { data } = useSimilarMedia(mediaId)
  const { defaults } = useGalleryDefaults()

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
            </li>
          )
        })}
      </ul>
    </div>
  )
}
