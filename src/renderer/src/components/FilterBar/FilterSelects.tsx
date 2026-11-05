import { useTranslation } from 'react-i18next'
import type { MediaFilters } from '@shared/models'

interface FilterSelectProps {
  filters: MediaFilters
  onFiltersChange: (filters: MediaFilters) => void
}

export function TypeFilter({ filters, onFiltersChange }: FilterSelectProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <label className="filter-field">
      <span className="filter-label">{t('filters.type')}</span>
      <select
        value={filters.type ?? 'all'}
        onChange={(e) => {
          const selected = e.target.value
          onFiltersChange({
            ...filters,
            type: selected === 'all' ? undefined : (selected as MediaFilters['type'])
          })
        }}
      >
        <option value="all">{t('filters.typeAll')}</option>
        <option value="image">{t('filters.typeImage')}</option>
        <option value="video">{t('filters.typeVideo')}</option>
        <option value="gif">{t('filters.typeGif')}</option>
      </select>
    </label>
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
