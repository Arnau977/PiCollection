import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import type { TagFinderState } from '../../hooks/useTagFinder'
import './TagFinder.css'

interface TagFinderProps {
  finder: TagFinderState
  matchCount: number
  total: number
}

/** The find bar above a media's tag chips (see useTagFinder). */
export function TagFinder({ finder, matchCount, total }: TagFinderProps): JSX.Element | null {
  const { t } = useTranslation()
  if (!finder.open) return null
  const typed = finder.query.trim().length > 0

  return (
    <div className="tag-finder" role="search">
      <Search size={14} aria-hidden="true" className="tag-finder-icon" />
      <input
        type="search"
        // Opened on purpose (Ctrl+F or the button), so typing starts here.
        autoFocus
        aria-label={t('tagFinder.label')}
        placeholder={t('tagFinder.placeholder')}
        value={finder.query}
        onChange={(e) => finder.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          // Closes the bar only, not the edit form behind it.
          e.stopPropagation()
          finder.close()
        }}
      />
      <span
        role="status"
        className={`tag-finder-status${typed && matchCount === 0 ? ' is-none' : ''}`}
      >
        {typed &&
          (matchCount === 0
            ? t('tagFinder.none')
            : t('tagFinder.matches', { count: matchCount, total }))}
      </span>
      <button
        type="button"
        className="tag-finder-close"
        aria-label={t('tagFinder.close')}
        title={t('tagFinder.close')}
        onClick={finder.close}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
