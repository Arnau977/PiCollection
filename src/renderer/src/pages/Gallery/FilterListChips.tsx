import { useTranslation } from 'react-i18next'
import { Bookmark, X } from 'lucide-react'
import { useFilterLists } from '../../hooks/useEntityLists'

interface FilterListChipsProps {
  ids: string[]
  onRemove: (id: string) => void
}

/** One chip per list applied to the gallery: neutral, since a list mixes categories. */
export function FilterListChips({ ids, onRemove }: FilterListChipsProps): JSX.Element | null {
  const { t } = useTranslation()
  const { data } = useFilterLists()
  const applied = data.filter((list) => ids.includes(list.id))
  if (applied.length === 0) return null

  return (
    <ul className="filter-list-chips">
      {applied.map((list) => (
        <li key={list.id} className="filter-list-chip">
          <Bookmark size={14} aria-hidden="true" />
          <span className="filter-list-chip-name" title={list.name}>
            {list.name}
          </span>
          <button
            type="button"
            aria-label={t('filterLists.removeChip', { name: list.name })}
            title={t('filterLists.removeChip', { name: list.name })}
            onClick={() => onRemove(list.id)}
          >
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  )
}
