import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaFilters } from '@shared/models'
import { TypeChecks } from './TypeChecks'

interface FilterSelectProps {
  filters: MediaFilters
  onFiltersChange: (filters: MediaFilters) => void
}

export function TypeFilter({ filters, onFiltersChange }: FilterSelectProps): JSX.Element {
  const { t } = useTranslation()
  const labelId = useId()
  return (
    <div className="filter-field filter-type">
      <span className="filter-label" id={labelId}>
        {t('filters.type')}
      </span>
      <TypeChecks
        types={filters.type}
        onChange={(type) => onFiltersChange({ ...filters, type })}
        labelledBy={labelId}
      />
    </div>
  )
}

export function SfwFilter({ filters, onFiltersChange }: FilterSelectProps): JSX.Element {
  const { t } = useTranslation()
  return (
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
  )
}

export function AiFilter({ filters, onFiltersChange }: FilterSelectProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <label className="filter-field">
      <span className="filter-label">{t('filters.ai')}</span>
      <select
        value={filters.isAiGenerated === undefined ? 'all' : filters.isAiGenerated ? 'ai' : 'notAi'}
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
  )
}
