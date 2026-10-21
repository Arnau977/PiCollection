import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsLeftRight, Columns2, X } from 'lucide-react'
import { useZoomPan } from '../Lightbox/useZoomPan'
import { ZoomControls } from '../Lightbox/ZoomControls'
import '../Lightbox/Lightbox.css'
import { dividerBounds, isOverImage, type Dimensions } from './dividerBounds'
import { fetchFileSize } from './fileSize'
import { useSourceFolder } from '../../hooks/useSourceFolder'
import { CompareLabel } from './CompareLabel'
import { CompareTaxonomy } from './CompareTaxonomy'
import type { ComparedTaxonomy } from './taxonomyDiff'
import './MediaCompare.css'

/** Where the file stands: already in the library, waiting in Pending, or not saved yet. */
export type ComparedStatus = 'library' | 'pending' | 'new'

export interface ComparedMedia {
  src: string
  /** Where the file lives, shown relative to the source folder. */
  route: string
  /** Alt text for the picture. */
  name: string
  status?: ComparedStatus
  /** What the file is tagged with, listed side by side. */
  taxonomy: ComparedTaxonomy
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
 * "Side by side" (S) shows the two pictures next to each other instead, with
 * the same shared zoom, and lists what each one is tagged with.
 */
export function MediaCompare({ left, right, onClose }: MediaCompareProps): JSX.Element {
  const { t } = useTranslation()
  const sourceFolder = useSourceFolder()
  const [sideBySide, setSideBySide] = useState(false)
  // The zoom box: the whole stage when split, the left pane side by side
  // (the right pane mirrors it - see the wheel forwarding below).
  const stageRef = useRef<HTMLDivElement>(null)
  const rightPaneRef = useRef<HTMLDivElement>(null)
  const zoom = useZoomPan(stageRef, sideBySide)
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

  // The two layouts fit the pictures to different boxes, so a zoom from one
  // means nothing in the other.
  function toggleSideBySide(): void {
    zoom.reset()
    setSideBySide((prev) => !prev)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') zoom.zoomIn()
      if (e.key === '-') zoom.zoomOut()
      if (e.key === '0') zoom.reset()
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        zoom.reset()
        setSideBySide((prev) => !prev)
      }
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
  }, [sideBySide])

  // Side by side, the zoom box is the left pane; the wheel over the right
  // pane zooms the same spot by replaying the event over the left one.
  useEffect(() => {
    const right = rightPaneRef.current
    if (!sideBySide || !right) return
    function handleWheel(e: WheelEvent): void {
      const left = stageRef.current
      if (!left || !right) return
      e.preventDefault()
      const shift = right.getBoundingClientRect().left - left.getBoundingClientRect().left
      left.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: e.deltaY,
          clientX: e.clientX - shift,
          clientY: e.clientY,
          cancelable: true
        })
      )
    }
    right.addEventListener('wheel', handleWheel, { passive: false })
    return (): void => right.removeEventListener('wheel', handleWheel)
  }, [sideBySide])

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

  // The backdrop, the body and the gaps in the labels row and between the
  // side-by-side panes - not the labels,
  // buttons or the stage, which handles its own clicks outside the images.
  function isEmptyArea(e: React.SyntheticEvent): boolean {
    const target = e.target as HTMLElement
    return (
      target === e.currentTarget ||
      target.classList.contains('media-compare-body') ||
      target.classList.contains('media-compare-labels') ||
      target.classList.contains('media-compare-panes')
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

  const labelFor = (side: 'left' | 'right'): JSX.Element => (
    <CompareLabel
      media={side === 'left' ? left : right}
      size={sizes[side]}
      bytes={fileSizes[side]}
      sourceFolder={sourceFolder}
    />
  )

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
          {labelFor('left')}
          <div className="lightbox-actions">
            <button
              type="button"
              className="icon-btn media-compare-mode"
              aria-pressed={sideBySide}
              aria-label={t('mediaCompare.sideBySide')}
              title={t('mediaCompare.sideBySideTitle')}
              aria-keyshortcuts="S"
              onClick={toggleSideBySide}
            >
              <Columns2 size={18} />
            </button>
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
          {labelFor('right')}
        </div>
        {sideBySide ? (
          <>
            {/* Both panes share one zoom, so the same detail shows on each. */}
            <div className={`media-compare-panes${zoom.isZoomed ? ' is-zoomed' : ''}`}>
              {(['left', 'right'] as const).map((side) => {
                const media = side === 'left' ? left : right
                return (
                  <div
                    key={side}
                    ref={side === 'left' ? stageRef : rightPaneRef}
                    className="media-compare-pane"
                    onPointerDown={zoom.handlers.onPointerDown}
                    onPointerMove={zoom.handlers.onPointerMove}
                    onPointerUp={zoom.handlers.onPointerUp}
                    onPointerCancel={zoom.handlers.onPointerUp}
                    onDoubleClick={zoom.handlers.onDoubleClick}
                  >
                    <img
                      src={media.src}
                      alt={media.name}
                      draggable={false}
                      style={zoom.style}
                      onLoad={(e) => recordSize(side, e.currentTarget)}
                    />
                  </div>
                )
              })}
            </div>
            <CompareTaxonomy left={left.taxonomy} right={right.taxonomy} />
          </>
        ) : (
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
        )}
      </div>
    </div>
  )
}
