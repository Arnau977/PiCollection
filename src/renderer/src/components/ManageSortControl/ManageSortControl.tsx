import { useTranslation } from 'react-i18next'
import type { ManageSort } from '../../utils/manageSort'

interface ManageSortControlProps {
  sort: ManageSort
  onChange: (sort: ManageSort) => void
}

/** No wrapping element of its own — callers place it inside their own `.manage-sort-row`
 * flex container, alongside any other filter controls that row needs (e.g. the
 * Characters series filter in Task 6). */
export function ManageSortControl({ sort, onChange }: ManageSortControlProps): JSX.Element {
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
        </select>
      </label>
      <button type="button" className="btn" onClick={() => onChange({ ...sort, desc: !sort.desc })}>
        {sort.desc ? t('manage.descending') : t('manage.ascending')}
      </button>
    </>
  )
}
