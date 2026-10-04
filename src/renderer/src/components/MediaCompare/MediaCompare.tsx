import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsLeftRight, X } from 'lucide-react'
import { useZoomPan } from '../Lightbox/useZoomPan'
import { ZoomControls } from '../Lightbox/ZoomControls'
import '../Lightbox/Lightbox.css'
import { dividerBounds, isOverImage, type Dimensions } from './dividerBounds'
import { fetchFileSize, fileFormat, formatFileSize } from './fileSize'
import './MediaCompare.css'

/** Where the file stands: already in the library, waiting in Pending, or not saved yet. */
export type ComparedStatus = 'library' | 'pending' | 'new'

export interface ComparedMedia {
  src: string
  name: string
  status?: ComparedStatus
}

interface MediaCompareProps {
  left: ComparedMedia
  right: ComparedMedia
  onClose: () => void
}

/** Grabbing within this many px of the divider line moves it, even while zoomed. */
const DIVIDER_GRAB_PX = 14
/** A press that moves less than this is a click, not a drag (same as useZoomPan). */
const CLICK_SLOP_PX = 4

/** Where a press on the stage started, and whether it has turned into a drag. */
interface StagePress {
  x: number
  y: number
  outside: boolean
  moved: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Full-size overlay with both images stacked in the same box and a movable
 * divider: left of it shows `left`, right of it shows `right`. Both are
 * fitted to the same box, so identical pictures line up exactly whatever
 * their resolution, and any difference shows up while dragging. Zoom (wheel,
 * double-click, +/-/0) applies to both at once so the same detail is
 * compared; once zoomed, dragging pans and the divider moves by its handle.
 */
export function MediaCompare({ left, right, onClose }: MediaCompareProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const zoom = useZoomPan(stageRef)
  const [split, setSplit] = useState(50)
  const [sizes, setSizes] = useState<{ left?: Dimensions; right?: Dimensions }>({})
  const [stage, setStage] = useState<Dimensions | null>(null)
  const [fileSizes, setFileSizes] = useState<{ left?: number; right?: number }>({})
  const draggingDivider = useRef(false)
  const press = useRef<StagePress | null>(null)
  // A press on the empty area around the stage (the labels row's gaps), so
  // a drag that only ends there doesn't count as a click outside.
  const pressedOnBackdrop = useRef(false)

  // Same-resolution copies can still differ a lot in weight (recompressed
  // re-uploads), which the picture alone doesn't show.
  useEffect(() => {
    let cancelled = false
    setFileSizes({})
    void Promise.all([fetchFileSize(left.src), fetchFileSize(right.src)]).then(([l, r]) => {
      if (!cancelled) setFileSizes({ left: l ?? undefined, right: r ?? undefined })
    })
    return (): void => {
      cancelled = true
    }
  }, [left.src, right.src])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') zoom.zoomIn()
      if (e.key === '-') zoom.zoomOut()
      if (e.key === '0') zoom.reset()
    }
    document.addEventListener('keydown', handleKeyDown)
    return (): void => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, zoom])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const observer = new ResizeObserver(() =>
      setStage({ width: el.clientWidth, height: el.clientHeight })
    )
    observer.observe(el)
    return (): void => observer.disconnect()
  }, [])

  const { min: minSplit, max: maxSplit } = dividerBounds([sizes.left, sizes.right], stage, {
    scale: zoom.scale,
    offsetX: zoom.offset.x
  })
  const shownSplit = clamp(split, minSplit, maxSplit)

  function splitAt(clientX: number): void {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setSplit(clamp(((clientX - rect.left) / rect.width) * 100, minSplit, maxSplit))
  }

  function isNearDivider(clientX: number): boolean {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return false
    return Math.abs(clientX - (rect.left + (rect.width * shownSplit) / 100)) <= DIVIDER_GRAB_PX
  }

  function stagePoint(e: React.PointerEvent<HTMLDivElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function isOutsideImages(point: { x: number; y: number }): boolean {
    return !isOverImage(point, [sizes.left, sizes.right], stage, {
      scale: zoom.scale,
      offsetX: zoom.offset.x,
      offsetY: zoom.offset.y
    })
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return
    const point = stagePoint(e)
    const outside = isOutsideImages(point)
    press.current = { ...point, outside, moved: false }
    // A press on the letterbox may just be a click to close: the divider
    // only follows once it actually turns into a drag.
    if (outside && !zoom.isZoomed) {
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    // Unzoomed, pressing anywhere moves the divider there (and drags it);
    // zoomed, only the divider itself does - the rest of the stage pans.
    if (!zoom.isZoomed || isNearDivider(e.clientX)) {
      draggingDivider.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      splitAt(e.clientX)
      return
    }
    zoom.handlers.onPointerDown(e)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const current = press.current
    if (current && !current.moved) {
      const point = stagePoint(e)
      if (Math.hypot(point.x - current.x, point.y - current.y) >= CLICK_SLOP_PX) {
        current.moved = true
        if (current.outside && !zoom.isZoomed) draggingDivider.current = true
      }
    }
    if (draggingDivider.current) splitAt(e.clientX)
    else zoom.handlers.onPointerMove(e)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    const current = press.current
    press.current = null
    // Closes only on a click both pressed and released outside the images:
    // a drag (divider or pan) that merely ends out there doesn't count.
    const clickedOutside =
      e.type === 'pointerup' &&
      current !== null &&
      current.outside &&
      !current.moved &&
      isOutsideImages(stagePoint(e))
    draggingDivider.current = false
    zoom.handlers.onPointerUp(e)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (clickedOutside) onClose()
  }

  // The backdrop, the body and the labels row's gaps - not the labels,
  // buttons or the stage, which handles its own clicks outside the images.
  function isEmptyArea(e: React.SyntheticEvent): boolean {
    const target = e.target as HTMLElement
    return (
      target === e.currentTarget ||
      target.classList.contains('media-compare-body') ||
      target.classList.contains('media-compare-labels')
    )
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    // Same as Lightbox: never let a click reach the page underneath, and a
    // pan that ends over the backdrop isn't a request to close.
    e.stopPropagation()
    if (pressedOnBackdrop.current && isEmptyArea(e) && !zoom.wasDragged()) onClose()
  }

  function recordSize(side: 'left' | 'right', img: HTMLImageElement): void {
    const size = { width: img.naturalWidth, height: img.naturalHeight }
    setSizes((prev) => ({ ...prev, [side]: size }))
  }

  function label(side: 'left' | 'right', media: ComparedMedia): JSX.Element {
    const size = sizes[side]
    const bytes = fileSizes[side]
    const details = [
      fileFormat(media.src),
      size && t('mediaCompare.dimensions', size),
      bytes !== undefined && formatFileSize(bytes, i18n.language)
    ].filter(Boolean)
    return (
      <span className="media-compare-label">
        <span className="media-compare-label-name" title={media.name}>
          {media.name}
        </span>
        <span className="media-compare-label-meta">
          {media.status && (
            <span className="media-compare-status">{t(`mediaCompare.status.${media.status}`)}</span>
          )}
          {details.length > 0 && (
            <span className="media-compare-label-size">{details.join(' · ')}</span>
          )}
        </span>
      </span>
    )
  }

  return (
    <div
      className="lightbox-backdrop media-compare"
      role="dialog"
      aria-modal="true"
      aria-label={t('mediaCompare.title')}
      onPointerDown={(e) => (pressedOnBackdrop.current = isEmptyArea(e))}
      onClick={handleBackdropClick}
    >
      <div className="media-compare-body">
        <div className="media-compare-labels">
          {label('left', left)}
          <div className="lightbox-actions">
            <ZoomControls zoom={zoom} />
            <button
              type="button"
              className="icon-btn lightbox-close"
              aria-label={t('media.closeLightbox')}
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
          {label('right', right)}
        </div>
        <div
          ref={stageRef}
          className={`media-compare-stage${zoom.isZoomed ? ' is-zoomed' : ''}`}
          style={{ '--split': `${shownSplit}%` } as React.CSSProperties}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={zoom.handlers.onDoubleClick}
        >
          <div className="media-compare-layer">
            <img
              src={left.src}
              alt={left.name}
              draggable={false}
              style={zoom.style}
              onLoad={(e) => recordSize('left', e.currentTarget)}
            />
          </div>
          <div className="media-compare-layer media-compare-right">
            <img
              src={right.src}
              alt={right.name}
              draggable={false}
              style={zoom.style}
              onLoad={(e) => recordSize('right', e.currentTarget)}
            />
          </div>
          {/* Keyboard access to the divider (arrows/Home/End) with its
              value announced; the pointer is handled by the stage above. */}
          <input
            type="range"
            className="media-compare-range"
            min={0}
            max={100}
            value={Math.round(shownSplit)}
            onChange={(e) => setSplit(clamp(Number(e.target.value), minSplit, maxSplit))}
            aria-label={t('mediaCompare.slider')}
            aria-valuetext={t('mediaCompare.sliderValue', {
              left: Math.round(shownSplit),
              right: 100 - Math.round(shownSplit)
            })}
            autoFocus
          />
          <div className="media-compare-divider" aria-hidden="true">
            <span className="media-compare-handle">
              <ChevronsLeftRight size={16} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
