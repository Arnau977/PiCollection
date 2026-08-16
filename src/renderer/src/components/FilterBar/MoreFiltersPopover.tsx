import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal } from 'lucide-react'
import type { MediaFilters } from '@shared/models'
import './MoreFiltersPopover.css'

interface MoreFiltersPopoverProps {
  filters: MediaFilters
  onFiltersChange: (filters: MediaFilters) => void
}

/**
 * SFW and AI-generated are real filters, just lower-stakes than tag/character/
 * series/artist - they change far less often, so they collapse into this
 * popover instead of occupying two more always-visible selects next to search.
 */
export function MoreFiltersPopover({
  filters,
  onFiltersChange
}: MoreFiltersPopoverProps): JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeCount =
    (filters.sfw !== undefined ? 1 : 0) + (filters.isAiGenerated !== undefined ? 1 : 0)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return (): void => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div className="more-filters" ref={containerRef}>
      <button
        type="button"
        className="btn"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreHorizontal size={16} />
        {t('filters.more')}
        {activeCount > 0 && <span className="more-filters-badge">{activeCount}</span>}
      </button>

      {open && (
        <div className="more-filters-panel" role="group" aria-label={t('filters.more')}>
          <label className="filter-field">
            <span className="filter-label">{t('filters.sfw')}</span>
            <select
              value={filters.sfw === undefined ? 'all' : filters.sfw ? 'sfw' : 'nsfw'}
              onChange={(e) => {
                const selected = e.target.value
                onFiltersChange({
                  ...filters,
                  sfw: selected === 'all' ? undefined : selected === 'sfw'
                })
              }}
            >
              <option value="all">{t('filters.sfwAll')}</option>
              <option value="sfw">{t('filters.sfwOnly')}</option>
              <option value="nsfw">{t('filters.nsfwOnly')}</option>
            </select>
          </label>

          <label className="filter-field">
            <span className="filter-label">{t('filters.ai')}</span>
            <select
              value={
                filters.isAiGenerated === undefined ? 'all' : filters.isAiGenerated ? 'ai' : 'notAi'
              }
              onChange={(e) => {
                const selected = e.target.value
                onFiltersChange({
                  ...filters,
                  isAiGenerated: selected === 'all' ? undefined : selected === 'ai'
                })
              }}
            >
              <option value="all">{t('filters.aiAll')}</option>
              <option value="ai">{t('filters.aiOnly')}</option>
              <option value="notAi">{t('filters.aiExcluded')}</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
