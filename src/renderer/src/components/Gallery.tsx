import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '@renderer/app.routes.const'
import type { MediaModel } from '@shared/models'
import { MediaThumb } from './MediaThumb/MediaThumb'
import './Gallery.css'

interface GalleryProps {
  media: MediaModel[]
  blurNsfw?: boolean
  hideNames?: boolean
}

export default function Gallery({
  media,
  blurNsfw = false,
  hideNames = false
}: GalleryProps): JSX.Element {
  const { t } = useTranslation()

  if (media.length === 0) {
    return (
      <div className="gallery-empty">
        <p>{t('gallery.emptyTitle')}</p>
        <p>{t('gallery.emptyHint')}</p>
      </div>
    )
  }

  return (
    <ul className="gallery-grid">
      {media.map((item) => {
        const blurred = blurNsfw && !item.sfw
        return (
          <li key={item.id}>
            <Link to={PATH.MEDIA.replace(':id', item.id)} className="media-card">
              <div className={blurred ? 'thumb-wrap nsfw-blur' : 'thumb-wrap'}>
                <MediaThumb type={item.type} route={item.route} alt={item.name} />
                {blurred && <span className="nsfw-blur-overlay">{t('media.revealNsfw')}</span>}
              </div>
              {!hideNames && (
                <p className="media-card-name" title={item.name}>
                  {item.name}
                </p>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
