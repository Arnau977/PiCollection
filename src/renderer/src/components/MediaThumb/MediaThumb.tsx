import { useEffect, useRef, useState } from 'react'
import { ImageOff, Play } from 'lucide-react'
import type { MediaModel } from '@shared/models'
import { toMediaUrl, toThumbUrl } from '@shared/utils/mediaUrl'
import { captureVideoFrame } from './captureVideoFrame'
import './MediaThumb.css'

interface MediaThumbProps {
  type: MediaModel['type']
  route: string
  alt: string
}

/**
 * Grid thumbnail. Shows a small cached preview while idle and only loads the
 * full-size file on hover, where videos start playing and GIFs start animating.
 */
export function MediaThumb({ type, route, alt }: MediaThumbProps): JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [capturedFrameUrl, setCapturedFrameUrl] = useState<string | null>(null)
  const captureAttempted = useRef(false)

  const thumbUrl = toThumbUrl(route)
  const fullUrl = toMediaUrl(route)

  // GIFs animate by swapping in the original file; the still preview is enough otherwise.
  const previewSrc = type === 'gif' && hovered ? fullUrl : thumbUrl

  useEffect(() => {
    return (): void => {
      if (capturedFrameUrl) URL.revokeObjectURL(capturedFrameUrl)
    }
  }, [capturedFrameUrl])

  function handleThumbError(): void {
    setFailed(true)
    // Some containers/codecs the OS thumbnail provider rejects still play
    // back fine in Chromium (that's how hover-to-play already works for
    // them), so grab a frame ourselves as a last resort instead of just
    // showing a broken-image icon. Cache it so this only happens once.
    if (type !== 'video' || captureAttempted.current) return
    captureAttempted.current = true
    captureVideoFrame(fullUrl).then((blob) => {
      if (!blob) return
      setCapturedFrameUrl(URL.createObjectURL(blob))
      blob.arrayBuffer().then((buffer) => {
        window.api.media.cacheThumbnail(route, new Uint8Array(buffer))
      })
    })
  }

  return (
    <div
      className="media-thumb"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!failed && (
        <img
          alt={alt}
          src={previewSrc}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={handleThumbError}
        />
      )}

      {failed && capturedFrameUrl && <img alt={alt} src={capturedFrameUrl} />}

      {type === 'video' && hovered && (
        <video className="media-thumb-video" muted playsInline loop autoPlay src={fullUrl} />
      )}

      {type === 'video' && !hovered && (
        <span className="media-thumb-play" aria-hidden="true">
          <Play size={20} />
        </span>
      )}

      {type === 'gif' && !hovered && (
        <span className="media-thumb-gif-badge" aria-hidden="true">
          GIF
        </span>
      )}

      {failed && !capturedFrameUrl && (
        <span className="media-thumb-fallback" aria-hidden="true">
          <ImageOff size={20} />
        </span>
      )}

      {!loaded && !failed && <span className="media-thumb-loading" aria-hidden="true" />}
    </div>
  )
}
