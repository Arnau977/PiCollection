import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { toThumbUrl } from '@shared/utils/mediaUrl'
import './EntityThumbnail.css'

interface EntityThumbnailProps {
  route: string | null
  loading: boolean
}

/** Must match the `scale()` in EntityThumbnail.css's `:hover` rule. */
const HOVER_SCALE = 4.32

type ZoomOrigin = { x: 'left' | 'right'; y: 'top' | 'bottom' }

/**
 * Picks which corner the hover-zoom should grow from so the enlarged image
 * always lands fully inside the viewport, based on how much room is left on
 * each side of the thumbnail's own (unscaled) box - measuring that box
 * itself is safe to do mid-hover since `transform` never affects an
 * element's own layout rect, only its visual paint.
 */
function pickZoomOrigin(rect: DOMRect): ZoomOrigin {
  const extraWidth = rect.width * (HOVER_SCALE - 1)
  const extraHeight = rect.height * (HOVER_SCALE - 1)
  return {
    x: window.innerWidth - rect.right < extraWidth ? 'right' : 'left',
    y: window.innerHeight - rect.bottom < extraHeight ? 'bottom' : 'top'
  }
}

export function EntityThumbnail({ route, loading }: EntityThumbnailProps): JSX.Element {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [origin, setOrigin] = useState<ZoomOrigin>({ x: 'left', y: 'top' })

  const showPlaceholder = !loading && (!route || failed)

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>): void {
    setOrigin(pickZoomOrigin(e.currentTarget.getBoundingClientRect()))
  }

  return (
    <div className="entity-thumb" onMouseEnter={handleMouseEnter}>
      {/* A cached preview works for videos too, so a single <img> covers every type. */}
      {!loading && route && !failed && (
        <img
          src={toThumbUrl(route)}
          alt=""
          loading="lazy"
          style={{ transformOrigin: `${origin.x} ${origin.y}` }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}

      {showPlaceholder && (
        <span className="entity-thumb-placeholder">
          <ImageOff size={16} />
        </span>
      )}

      {(loading || (route && !loaded && !failed)) && (
        <span className="entity-thumb-loading" aria-hidden="true" />
      )}
    </div>
  )
}
