import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { splitDtextLinks, stripDtext } from '../../utils/dtext'
import { useDanbooruCredentialsConfigured } from '../../hooks/useDanbooruCredentialsConfigured'
import './TagWikiInfo.css'

interface TagWikiInfoProps {
  tagName: string
}

type LoadState = 'idle' | 'loading' | 'error' | 'not-found' | 'loaded'

const POPOVER_MAX_WIDTH = 360
// Keep in sync with the CSS `max-height` on .tag-wiki-info-popover.
const POPOVER_MAX_HEIGHT = 320
const MARGIN = 12

function computePosition(anchor: DOMRect): { top: number; left: number } {
  const left = Math.min(
    Math.max(anchor.right - POPOVER_MAX_WIDTH, MARGIN),
    window.innerWidth - POPOVER_MAX_WIDTH - MARGIN
  )
  const top = Math.max(
    Math.min(anchor.bottom + 8, window.innerHeight - POPOVER_MAX_HEIGHT - MARGIN),
    MARGIN
  )
  return { top, left }
}

export function TagWikiInfo({ tagName }: TagWikiInfoProps): JSX.Element | null {
  const { t } = useTranslation()
  const hasDanbooruAccount = useDanbooruCredentialsConfigured()
  const containerRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [state, setState] = useState<LoadState>('idle')
  const [body, setBody] = useState<string | null>(null)
  const [otherNames, setOtherNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent): void {
      const target = event.target as Node
      if (!containerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    // The popover renders in a portal, positioned relative to the viewport
    // from a rect captured on open - if the anchor's scroll container (e.g.
    // the suggestions panel) scrolls, the anchor moves out from under it, so
    // close rather than leave a disconnected floating box.
    function handleScroll(event: Event): void {
      if (popoverRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('scroll', handleScroll, true)
    return (): void => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  async function handleClick(): Promise<void> {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) setPosition(computePosition(rect))

    if (state !== 'idle') {
      setOpen((prev) => !prev)
      return
    }
    setOpen(true)
    setState('loading')
    const result = await window.api.tagWiki.lookup(tagName)
    if (!result.success) {
      setError(result.error.message)
      setState('error')
      return
    }
    if (result.data === null) {
      setState('not-found')
      return
    }
    setBody(stripDtext(result.data.body))
    setOtherNames(result.data.otherNames)
    setState('loaded')
  }

  if (!hasDanbooruAccount) return null

  return (
    <span className="tag-wiki-info" ref={containerRef}>
      <button
        type="button"
        className="icon-btn"
        aria-label={`${t('manage.tagWikiInfoLabel')} (${tagName})`}
        onClick={handleClick}
      >
        <Info size={16} />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            className="tag-wiki-info-popover"
            role="status"
            ref={popoverRef}
            style={{ top: position.top, left: position.left }}
          >
            {state === 'loading' && <p>{t('manage.tagWikiLoading')}</p>}
            {state === 'error' && <p role="alert">{error}</p>}
            {state === 'not-found' && <p>{t('manage.tagWikiNotFound')}</p>}
            {state === 'loaded' && (
              <>
                <p className="tag-wiki-info-body">
                  {body &&
                    splitDtextLinks(body).map((segment, index) =>
                      segment.href ? (
                        <a key={index} href={segment.href} target="_blank" rel="noreferrer">
                          {segment.text}
                        </a>
                      ) : (
                        <span key={index}>{segment.text}</span>
                      )
                    )}
                </p>
                {otherNames.length > 0 && (
                  <p className="tag-wiki-info-other-names">
                    {t('manage.tagWikiOtherNames')}: {otherNames.join(', ')}
                  </p>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </span>
  )
}
