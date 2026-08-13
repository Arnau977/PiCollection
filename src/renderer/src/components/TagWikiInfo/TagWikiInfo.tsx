import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { splitDtextLinks, stripDtext } from '../../utils/dtext'
import './TagWikiInfo.css'

interface TagWikiInfoProps {
  tagName: string
}

type LoadState = 'idle' | 'loading' | 'error' | 'not-found' | 'loaded'

export function TagWikiInfo({ tagName }: TagWikiInfoProps): JSX.Element {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<LoadState>('idle')
  const [body, setBody] = useState<string | null>(null)
  const [otherNames, setOtherNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  async function handleClick(): Promise<void> {
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
      {open && (
        <div className="tag-wiki-info-popover" role="status">
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
        </div>
      )}
    </span>
  )
}
