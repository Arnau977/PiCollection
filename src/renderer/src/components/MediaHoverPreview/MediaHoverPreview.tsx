import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { MediaModel } from '@shared/models'
import { splitRoute } from '../../utils/splitRoute'
import { MediaThumb } from '../MediaThumb/MediaThumb'
import './MediaHoverPreview.css'

interface MediaHoverPreviewProps {
  media: MediaModel
  children: React.ReactNode
  /** Makes the trigger a button (e.g. to open a full-size comparison). */
  onClick?: () => void
}

const CARD_WIDTH = 260
const CARD_MAX_HEIGHT = 360
const MARGIN = 12
const SHOW_DELAY_MS = 150

function computePosition(anchor: DOMRect): { top: number; left: number } {
  let left = Math.min(anchor.left, window.innerWidth - CARD_WIDTH - MARGIN)
  left = Math.max(left, MARGIN)

  let top = anchor.bottom + 6
  if (top + CARD_MAX_HEIGHT > window.innerHeight - MARGIN) {
    top = anchor.top - CARD_MAX_HEIGHT - 6
  }
  top = Math.max(top, MARGIN)

  return { top, left }
}

/** Hovering (or focusing, for keyboard users) the wrapped trigger shows a
 * floating card with the referenced media's thumbnail and tags - context for
 * a bare filename in a duplicate-check list. */
export function MediaHoverPreview({
  media,
  children,
  onClick
}: MediaHoverPreviewProps): JSX.Element {
  const { t } = useTranslation()
  // The list it serves names files as the form's Location does - by file name.
  const { fileName } = splitRoute(media.route)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const anchorRef = useRef<HTMLElement>(null)

  useEffect((): (() => void) => () => clearTimeout(timerRef.current), [])

  function show(): void {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout((): void => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setPosition(computePosition(rect))
    }, SHOW_DELAY_MS)
  }

  function hide(): void {
    clearTimeout(timerRef.current)
    setPosition(null)
  }

  const Trigger = onClick ? 'button' : 'span'

  return (
    <Trigger
      ref={anchorRef as React.RefObject<HTMLButtonElement & HTMLSpanElement>}
      className={
        onClick
          ? 'media-hover-preview-trigger media-hover-preview-trigger-button'
          : 'media-hover-preview-trigger'
      }
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      {...(onClick
        ? {
            type: 'button' as const,
            onClick: (): void => {
              hide()
              onClick()
            },
            'aria-label': t('mediaCompare.openLabel', { name: fileName })
          }
        : {
            tabIndex: 0,
            'aria-label': t('addMedia.duplicatePreviewLabel', { name: fileName })
          })}
    >
      {children}
      {position &&
        createPortal(
          <div
            className="media-hover-preview-card"
            style={{ top: position.top, left: position.left, width: CARD_WIDTH }}
          >
            <div className="media-hover-preview-thumb">
              <MediaThumb type={media.type} route={media.route} alt={media.name} />
            </div>
            <p className="media-hover-preview-name">{fileName}</p>
            {onClick && <p className="media-hover-preview-hint">{t('mediaCompare.clickHint')}</p>}
            {media.tags && media.tags.length > 0 && (
              <ul className="chip-list chip-list-tags media-hover-preview-tags">
                {media.tags.map((tag) => (
                  <li key={tag.id}>{tag.name}</li>
                ))}
              </ul>
            )}
          </div>,
          document.body
        )}
    </Trigger>
  )
}
