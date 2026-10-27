import { useTranslation } from 'react-i18next'
import { formatFileSize } from '../../utils/fileSize'

export interface StorageBarItem {
  key: string
  label: string
  bytes: number
  count: number
  /** Accessible name of the row's action (open in gallery, open folder). */
  actionLabel?: string
  onOpen?: () => void
}

interface StorageBarListProps {
  items: StorageBarItem[]
  /** What the percentages are a share of (the library's total). */
  totalBytes: number
  /** CSS color of the bars - the category's own color. */
  color: string
}

/**
 * Ranked rows with a thin bar each: name, size, share of the library. A
 * list rather than a chart, so every value is read as text (the bars only
 * add the at-a-glance proportion) and it doubles as its own table view.
 */
export function StorageBarList({ items, totalBytes, color }: StorageBarListProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const largest = items[0]?.bytes ?? 0
  const percent = new Intl.NumberFormat(i18n.language, {
    style: 'percent',
    maximumFractionDigits: 1
  })

  return (
    <ul className="storage-bars" style={{ '--storage-bar-color': color } as React.CSSProperties}>
      {items.map((item) => (
        <li key={item.key} className="storage-bar-row">
          {item.onOpen ? (
            <button
              type="button"
              className="storage-bar-name"
              title={item.actionLabel}
              aria-label={item.actionLabel}
              onClick={item.onOpen}
            >
              {item.label}
            </button>
          ) : (
            <span className="storage-bar-name">{item.label}</span>
          )}
          <span className="storage-bar-track" aria-hidden="true">
            <span
              className="storage-bar-fill"
              style={{ width: `${largest > 0 ? (item.bytes / largest) * 100 : 0}%` }}
            />
          </span>
          <span className="storage-bar-size">{formatFileSize(item.bytes, i18n.language)}</span>
          <span className="storage-bar-share">
            {totalBytes > 0 ? percent.format(item.bytes / totalBytes) : '–'}
          </span>
          <span className="storage-bar-count">{t('storage.files', { count: item.count })}</span>
        </li>
      ))}
    </ul>
  )
}
