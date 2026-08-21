import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Images } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import type { MediaModel } from '@shared/models'
import type { GalleryDensity } from '../../utils/gallerySettings'
import { EmptyState } from '../EmptyState/EmptyState'
import { MediaThumb } from '../MediaThumb/MediaThumb'
import './Gallery.css'

const DENSITY_THUMB_MIN: Record<GalleryDensity, string> = {
  compact: '96px',
  comfortable: '160px',
  large: '240px'
}

interface GalleryProps {
  media: MediaModel[]
  blurNsfw?: boolean
  hideNames?: boolean
  density?: GalleryDensity
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  returnHighlightId?: string
}

export default function Gallery({
  media,
  blurNsfw = false,
  hideNames = false,
  density = 'comfortable',
  selectedIds,
  onToggleSelect,
  returnHighlightId
}: GalleryProps): JSX.Element {
  const { t } = useTranslation()

  if (media.length === 0) {
    return (
      <EmptyState
        icon={<Images />}
        title={t('gallery.emptyTitle')}
        hint={t('gallery.emptyHint')}
        action={{ label: t('gallery.addMedia'), to: PATH.ADD_MEDIA }}
      />
    )
  }

  // Estimate card height based on density: thumb (aspect 1:1) + name label (~35-40px)
  const DENSITY_CARD_HEIGHT: Record<GalleryDensity, string> = {
    compact: '135px',
    comfortable: '200px',
    large: '280px'
  }

  const hasSelection = (selectedIds?.size ?? 0) > 0

  return (
    <ul
      className={hasSelection ? 'gallery-grid has-selection' : 'gallery-grid'}
      style={{
        '--gallery-thumb-min': DENSITY_THUMB_MIN[density],
        '--gallery-card-height': DENSITY_CARD_HEIGHT[density]
      } as React.CSSProperties}
    >
      {media.map((item) => {
        const blurred = blurNsfw && !item.sfw
        const isSelected = selectedIds?.has(item.id) ?? false
        return (
          <li key={item.id} className="gallery-tile" data-media-id={item.id}>
            {onToggleSelect && (
              <button
                type="button"
                className={isSelected ? 'gallery-tile-select is-selected' : 'gallery-tile-select'}
                aria-pressed={isSelected}
                aria-label={
                  isSelected
                    ? t('gallery.deselectItem', { name: item.name })
                    : t('gallery.selectItem', { name: item.name })
                }
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect(item.id)
                }}
              >
                {isSelected && <Check size={14} aria-hidden="true" />}
              </button>
            )}
            <Link
              to={PATH.MEDIA.replace(':id', item.id)}
              className={
                item.id === returnHighlightId ? 'media-card gallery-return-highlight' : 'media-card'
              }
            >
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
