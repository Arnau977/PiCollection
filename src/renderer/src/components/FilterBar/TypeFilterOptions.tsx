import { useTranslation } from 'react-i18next'
import { TYPE_FILTER_CHOICES } from '@shared/query/mediaTypes'
import { typeFilterLabel } from './typeFilterLabel'

/** The `<option>`s of a type filter `<select>`; values come from typeFilterValue. */
export function TypeFilterOptions(): JSX.Element {
  const { t } = useTranslation()
  return (
    <>
      <option value="all">{t('filters.typeAll')}</option>
      {TYPE_FILTER_CHOICES.map((types) => (
        <option key={types.join(',')} value={types.join(',')}>
          {typeFilterLabel(types, t)}
        </option>
      ))}
    </>
  )
}
