import { useTranslation } from 'react-i18next'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { MAX_ZOOM, type ZoomPan } from './useZoomPan'

/** The -/%/+ pill shared by the Lightbox and the compare view. */
export function ZoomControls({ zoom }: { zoom: ZoomPan }): JSX.Element {
  const { t } = useTranslation()
  return (
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
  )
}
