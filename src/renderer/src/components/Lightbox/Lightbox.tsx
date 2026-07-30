import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { MediaFileActions } from '../MediaFileActions/MediaFileActions'
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return (): void => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    // The overlay renders inside the media detail page, which navigates back to
    // the gallery on outside clicks - swallow every click so closing the
    // lightbox returns to the detail view instead of leaving it.
    e.stopPropagation()
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="lightbox-backdrop" onClick={handleBackdropClick}>
      <div className="lightbox-actions">
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
          <img src={src} alt={alt} />
        )}
      </div>
    </div>
  )
}
