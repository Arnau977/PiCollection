import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal } from 'lucide-react'
import type { MediaFilters } from '@shared/models'
import { AiFilter, SfwFilter } from './FilterSelects'
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
          <SfwFilter filters={filters} onFiltersChange={onFiltersChange} />
          <AiFilter filters={filters} onFiltersChange={onFiltersChange} />
        </div>
      )}
    </div>
  )
}
