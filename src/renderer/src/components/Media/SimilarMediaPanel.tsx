import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '../../app.routes.const'
import { useSimilarMedia } from '../../hooks/useSimilarMedia'
import { MediaThumb } from '../MediaThumb/MediaThumb'
import './SimilarMediaPanel.css'

interface SimilarMediaPanelProps {
  mediaId: string
}

export function SimilarMediaPanel({ mediaId }: SimilarMediaPanelProps): JSX.Element | null {
  const { t } = useTranslation()
  const { data } = useSimilarMedia(mediaId)

  if (data.length === 0) return null

  return (
    <div className="media-detail-section">
      <h2>{t('media.similarMedia')}</h2>
      <ul className="similar-media-grid">
        {data.map(({ media }) => (
          <li key={media.id}>
            <Link to={PATH.MEDIA.replace(':id', media.id)} aria-label={media.name}>
              <MediaThumb type={media.type} route={media.route} alt={media.name} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
