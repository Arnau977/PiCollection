import { useTranslation } from 'react-i18next'
import type { ManageSort, ManageViewMode } from '../../utils/manageSort'

interface ManageSortControlProps {
  sort: ManageSort
  onChange: (sort: ManageSort) => void
  viewMode?: ManageViewMode
  onViewModeChange?: (mode: ManageViewMode) => void
}

/** No wrapping element of its own — callers place it inside their own `.manage-sort-row`
 * flex container, alongside any other filter controls that row needs (e.g. the
 * Characters series filter in Task 6). `viewMode`/`onViewModeChange` are optional -
 * only Series/Characters pass them; Tags/Artists get the plain sort control. */
export function ManageSortControl({
  sort,
  onChange,
  viewMode,
  onViewModeChange
}: ManageSortControlProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <>
      <label className="filter-field">
        <span className="filter-label">{t('manage.sortBy')}</span>
        <select
          value={sort.prop}
          onChange={(e) => onChange({ ...sort, prop: e.target.value as ManageSort['prop'] })}
        >
          <option value="name">{t('manage.sortName')}</option>
          <option value="createdAt">{t('manage.sortDate')}</option>
          <option value="count">{t('manage.sortCount')}</option>
        </select>
      </label>
      <button type="button" className="btn" onClick={() => onChange({ ...sort, desc: !sort.desc })}>
        {sort.desc ? t('manage.descending') : t('manage.ascending')}
      </button>
      {viewMode && onViewModeChange && (
        <div className="manage-view-toggle" role="group">
          <button
            type="button"
            className={viewMode === 'tree' ? 'btn is-active' : 'btn'}
            aria-pressed={viewMode === 'tree'}
            onClick={() => onViewModeChange('tree')}
          >
            {t('manage.viewTree')}
          </button>
          <button
            type="button"
            className={viewMode === 'flat' ? 'btn is-active' : 'btn'}
            aria-pressed={viewMode === 'flat'}
            onClick={() => onViewModeChange('flat')}
          >
            {t('manage.viewFlat')}
          </button>
        </div>
      )}
    </>
  )
}
