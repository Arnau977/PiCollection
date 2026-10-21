import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { MediaModel } from '@shared/models'
import { splitRoute } from '../../utils/splitRoute'
import { MediaThumb } from '../MediaThumb/MediaThumb'
import { TAXONOMY_CATEGORIES, taxonomyOf } from '../MediaCompare/taxonomyDiff'
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
/** Long enough for the pointer to cross from the trigger onto the card. */
const HIDE_DELAY_MS = 200
const GAP = 6

type CardPosition = { left: number } & ({ top: number } | { bottom: number })

function computePosition(anchor: DOMRect): CardPosition {
  const left = Math.max(Math.min(anchor.left, window.innerWidth - CARD_WIDTH - MARGIN), MARGIN)
  if (anchor.bottom + GAP + CARD_MAX_HEIGHT <= window.innerHeight - MARGIN) {
    return { left, top: anchor.bottom + GAP }
  }
  // Above the trigger, held by its bottom edge so a shorter card still sits
  // right next to it (no gap for the pointer to fall through).
  const bottom = window.innerHeight - anchor.top + GAP
  return { left, bottom: Math.min(bottom, window.innerHeight - MARGIN - CARD_MAX_HEIGHT) }
}

/** Hovering (or focusing, for keyboard users) the wrapped trigger shows a
 * floating card with the referenced media's thumbnail, characters, series
 * and tags - context for a bare filename in a duplicate-check list. The
 * pointer can move onto the card (to scroll a long tag list) without it
 * closing, and Esc dismisses it (WCAG 1.4.13). */
export function MediaHoverPreview({
  media,
  children,
  onClick
}: MediaHoverPreviewProps): JSX.Element {
  const { t } = useTranslation()
  // The list it serves names files as the form's Location does - by file name.
  const { fileName } = splitRoute(media.route)
  const [position, setPosition] = useState<CardPosition | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const anchorRef = useRef<HTMLElement>(null)
  const taxonomy = taxonomyOf(media)
  const hasNames = TAXONOMY_CATEGORIES.some((category) => taxonomy[category].length > 0)

  useEffect((): (() => void) => () => clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (!position) return
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      // Only the card closes - not the dialog or form it was opened from.
      e.stopPropagation()
      clearTimeout(timerRef.current)
      setPosition(null)
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return (): void => document.removeEventListener('keydown', handleKeyDown, true)
  }, [position])

  function show(): void {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout((): void => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setPosition(computePosition(rect))
    }, SHOW_DELAY_MS)
  }

  /** Waits a moment, so the pointer can cross the gap onto the card. */
  function scheduleHide(): void {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(hide, HIDE_DELAY_MS)
  }

  function keepOpen(): void {
    clearTimeout(timerRef.current)
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
      onMouseEnter={position ? keepOpen : show}
      onMouseLeave={scheduleHide}
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
          // Its events still bubble to the trigger through React's tree:
          // entering the card keeps it open, and a click on it opens the
          // comparison like a click on the name would.
          <div
            className="media-hover-preview-card"
            style={{ ...position, width: CARD_WIDTH }}
            // Keeps focus on the trigger, whose blur would close the card.
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="media-hover-preview-thumb">
              <MediaThumb type={media.type} route={media.route} alt={media.name} />
            </div>
            <p className="media-hover-preview-name">{fileName}</p>
            {onClick && <p className="media-hover-preview-hint">{t('mediaCompare.clickHint')}</p>}
            {hasNames && (
              <ul className="chip-list media-hover-preview-tags">
                {TAXONOMY_CATEGORIES.flatMap((category) =>
                  taxonomy[category].map((name) => (
                    <li key={`${category}:${name}`} className={`chip-category-${category}`}>
                      {name}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>,
          document.body
        )}
    </Trigger>
  )
}
