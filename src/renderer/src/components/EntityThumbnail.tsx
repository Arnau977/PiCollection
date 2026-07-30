import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { toThumbUrl } from '@shared/utils/mediaUrl'
import { useEntityThumbnail, type EntityThumbnailKind } from '../hooks/useEntityThumbnail'
import './EntityThumbnail.css'

interface EntityThumbnailProps {
  kind: EntityThumbnailKind
  id: string
}

export function EntityThumbnail({ kind, id }: EntityThumbnailProps): JSX.Element {
  const { route, loading } = useEntityThumbnail(kind, id)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const showPlaceholder = !loading && (!route || failed)

  return (
    <div className="entity-thumb">
      {/* A cached preview works for videos too, so a single <img> covers every type. */}
      {!loading && route && !failed && (
        <img
          src={toThumbUrl(route)}
          alt=""
          loading="lazy"
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
