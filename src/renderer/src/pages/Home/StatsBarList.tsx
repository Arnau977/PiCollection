import { useTranslation } from 'react-i18next'
import type { EntityCount } from '@shared/models'

interface StatsBarListProps {
  items: EntityCount[]
}

export function StatsBarList({ items }: StatsBarListProps): JSX.Element {
  const { t } = useTranslation()
  const max = Math.max(1, ...items.map((item) => item.count))

  if (items.length === 0) {
    return <p className="stats-empty">{t('home.noData')}</p>
  }

  return (
    <ul className="stats-bar-list">
      {items.map((item) => (
        <li key={item.id}>
          <span className="stats-bar-label">{item.name}</span>
          <div className="stats-bar-track">
            <div className="stats-bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="stats-bar-count">{item.count}</span>
        </li>
      ))}
    </ul>
  )
}
