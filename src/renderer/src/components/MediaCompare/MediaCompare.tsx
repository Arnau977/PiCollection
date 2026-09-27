import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsLeftRight, X } from 'lucide-react'
import '../Lightbox/Lightbox.css'
import './MediaCompare.css'

export interface ComparedMedia {
  src: string
  name: string
}

interface MediaCompareProps {
  left: ComparedMedia
  right: ComparedMedia
  onClose: () => void
}

type Dimensions = { width: number; height: number }

/**
 * Full-size overlay with both images stacked in the same box and a movable
 * divider: left of it shows `left`, right of it shows `right`. Both are
 * fitted to the same box, so identical pictures line up exactly whatever
 * their resolution, and any difference shows up while dragging.
 */
export function MediaCompare({ left, right, onClose }: MediaCompareProps): JSX.Element {
  const { t } = useTranslation()
  const [split, setSplit] = useState(50)
  const [sizes, setSizes] = useState<{ left?: Dimensions; right?: Dimensions }>({})

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return (): void => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    // Same as Lightbox: never let a click reach the page underneath.
    e.stopPropagation()
    if (e.target === e.currentTarget) onClose()
  }

  function recordSize(side: 'left' | 'right', img: HTMLImageElement): void {
    const size = { width: img.naturalWidth, height: img.naturalHeight }
    setSizes((prev) => ({ ...prev, [side]: size }))
  }

  function label(side: 'left' | 'right', media: ComparedMedia): JSX.Element {
    const size = sizes[side]
    return (
      <span className="media-compare-label">
        <span className="media-compare-label-name" title={media.name}>
          {media.name}
        </span>
        {size && (
          <span className="media-compare-label-size">{t('mediaCompare.dimensions', size)}</span>
        )}
      </span>
    )
  }

  return (
    <div
      className="lightbox-backdrop media-compare"
      role="dialog"
      aria-modal="true"
      aria-label={t('mediaCompare.title')}
      onClick={handleBackdropClick}
    >
      <div className="lightbox-actions">
        <button
          type="button"
          className="icon-btn lightbox-close"
          aria-label={t('media.closeLightbox')}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>

      <div className="media-compare-body">
        <div className="media-compare-labels">
          {label('left', left)}
          {label('right', right)}
        </div>
        <div
          className="media-compare-stage"
          style={{ '--split': `${split}%` } as React.CSSProperties}
        >
          <img src={left.src} alt={left.name} onLoad={(e) => recordSize('left', e.currentTarget)} />
          <img
            className="media-compare-right"
            src={right.src}
            alt={right.name}
            onLoad={(e) => recordSize('right', e.currentTarget)}
          />
          {/* An invisible native range input covering the whole stage: dragging
              anywhere, clicking to jump, and arrow/Home/End keys all come free. */}
          <input
            type="range"
            className="media-compare-range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            aria-label={t('mediaCompare.slider')}
            aria-valuetext={t('mediaCompare.sliderValue', {
              left: split,
              right: 100 - split
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
