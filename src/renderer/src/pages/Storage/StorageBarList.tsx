import { useTranslation } from 'react-i18next'
import { ChevronRight, File, Folder } from 'lucide-react'
import { formatFileSize } from '../../utils/fileSize'
import { averageSize, sortValue, type StorageSortProp } from './storageSort'

export interface StorageBarItem {
  key: string
  label: string
  bytes: number
  /** Files it holds (folders, entities); a single file shows none. */
  count?: number
  /** A folder (opens its contents) or a file (opens its media page) - shown by an icon. */
  kind?: 'folder' | 'file'
  /** Accessible name of the row's action (open in gallery, open folder or file). */
  actionLabel?: string
  onOpen?: () => void
}

interface StorageBarListProps {
  items: StorageBarItem[]
  /** What the percentages are a share of (the library's total). */
  totalBytes: number
  /** CSS color of the bars - the category's own color. */
  color: string
  /** The list's sort key: what the bars measure and which value stands out. */
  sortProp?: StorageSortProp
  /** The library's average file size: what a ranked average leans toward (see storageSort). */
  meanBytes?: number
}

function KindIcon({ kind }: { kind?: StorageBarItem['kind'] }): JSX.Element | null {
  if (kind === 'folder') return <Folder size={14} aria-hidden="true" />
  if (kind === 'file') return <File size={14} aria-hidden="true" />
  return null
}

/**
 * Ranked rows with a thin bar each: name, size, share of the library. A
 * list rather than a chart, so every value is read as text (the bars only
 * add the at-a-glance proportion) and it doubles as its own table view.
 */
export function StorageBarList({
  items,
  totalBytes,
  color,
  sortProp = 'size',
  meanBytes = 0
}: StorageBarListProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const valueOf = (item: StorageBarItem): number => sortValue(item, sortProp, meanBytes)
  const largest = items.reduce((max, item) => Math.max(max, valueOf(item)), 0)
  // By files or by average, the count column carries the ranked value.
  const countLeads = sortProp === 'count' || sortProp === 'average'
  const percent = new Intl.NumberFormat(i18n.language, {
    style: 'percent',
    maximumFractionDigits: 1
  })

  return (
    <ul
      className={countLeads ? 'storage-bars by-count' : 'storage-bars'}
      style={{ '--storage-bar-color': color } as React.CSSProperties}
    >
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
              <KindIcon kind={item.kind} />
              <span className="storage-bar-label">{item.label}</span>
              {item.kind === 'folder' && (
                <ChevronRight size={14} className="storage-bar-open" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="storage-bar-name">
              <KindIcon kind={item.kind} />
              <span className="storage-bar-label">{item.label}</span>
            </span>
          )}
          <span className="storage-bar-track" aria-hidden="true">
            <span
              className="storage-bar-fill"
              style={{ width: `${largest > 0 ? (valueOf(item) / largest) * 100 : 0}%` }}
            />
          </span>
          <span className="storage-bar-size">{formatFileSize(item.bytes, i18n.language)}</span>
          <span className="storage-bar-share">
            {totalBytes > 0 ? percent.format(item.bytes / totalBytes) : '–'}
          </span>
          <span className="storage-bar-count">
            {item.count !== undefined &&
              (sortProp === 'average'
                ? t('storage.filesAverage', {
                    count: item.count,
                    size: formatFileSize(averageSize(item), i18n.language)
                  })
                : t('storage.files', { count: item.count }))}
          </span>
        </li>
      ))}
    </ul>
  )
}
