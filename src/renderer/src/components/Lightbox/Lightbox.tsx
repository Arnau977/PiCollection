import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { MediaFileActions } from '../MediaFileActions/MediaFileActions'
import { MAX_ZOOM, useZoomPan } from './useZoomPan'
import './Lightbox.css'

interface LightboxProps {
  src: string
  type: 'image' | 'video' | 'gif'
  alt: string
  route: string
  onClose: () => void
}

export function Lightbox({ src, type, alt, route, onClose }: LightboxProps): JSX.Element {
  const { t } = useTranslation()
  const imageRef = useRef<HTMLImageElement>(null)
  const zoom = useZoomPan(imageRef)
  const canZoom = type !== 'video'

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
      if (!canZoom) return
      if (e.key === '+' || e.key === '=') zoom.zoomIn()
      if (e.key === '-') zoom.zoomOut()
      if (e.key === '0') zoom.reset()
    }
    document.addEventListener('keydown', handleKeyDown)
    return (): void => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, canZoom, zoom])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    // The overlay renders inside the media detail page, which navigates back to
    // the gallery on outside clicks - swallow every click so closing the
    // lightbox returns to the detail view instead of leaving it.
    e.stopPropagation()
    // A pan that ends over the backdrop still fires a click there - that's not a request to close.
    if (e.target === e.currentTarget && !zoom.wasDragged()) onClose()
  }

  return (
    <div className="lightbox-backdrop" onClick={handleBackdropClick}>
      <div className="lightbox-actions">
        {canZoom && (
          <div className="lightbox-zoom">
            <button
              type="button"
              className="icon-btn"
              aria-label={t('media.zoomOut')}
              title={t('media.zoomOut')}
              onClick={zoom.zoomOut}
              disabled={!zoom.isZoomed}
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              className="btn lightbox-zoom-level"
              aria-label={t('media.zoomReset', { percent: Math.round(zoom.scale * 100) })}
              title={t('media.zoomResetTitle')}
              onClick={zoom.reset}
            >
              {Math.round(zoom.scale * 100)}%
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('media.zoomIn')}
              title={t('media.zoomIn')}
              onClick={zoom.zoomIn}
              disabled={zoom.scale >= MAX_ZOOM}
            >
              <ZoomIn size={18} />
            </button>
          </div>
        )}
        <MediaFileActions route={route} type={type} />
        <button
          type="button"
          className="icon-btn lightbox-close"
          aria-label={t('media.closeLightbox')}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="lightbox-content">
        {type === 'video' ? (
          <video controls autoPlay src={src}>
            Your browser does not support the video tag.
          </video>
        ) : (
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            draggable={false}
            className={zoom.isZoomed ? 'lightbox-zoomed' : 'lightbox-zoomable'}
            style={zoom.style}
            {...zoom.handlers}
          />
        )}
      </div>
    </div>
  )
}
