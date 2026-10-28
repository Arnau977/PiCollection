import { useTranslation } from 'react-i18next'
import type { StorageFileType, StorageTotal } from '@shared/models'
import { formatFileSize } from '../../utils/fileSize'

const TYPES: StorageFileType[] = ['image', 'gif', 'video']

interface StorageTypeSplitProps {
  byType: Record<StorageFileType, StorageTotal>
  totalBytes: number
}

/**
 * The library split by file type: one segmented bar for the proportion and a
 * legend that names every type with its size, share and files, so the
 * colors never carry a value on their own. Types with nothing are left out.
 */
export function StorageTypeSplit({
  byType,
  totalBytes
}: StorageTypeSplitProps): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const percent = new Intl.NumberFormat(i18n.language, {
    style: 'percent',
    maximumFractionDigits: 1
  })
  const present = TYPES.filter((type) => byType[type].count > 0)
  if (totalBytes === 0 || present.length === 0) return null

  return (
    <section className="storage-types" aria-label={t('storage.byTypeLabel')}>
      <div className="storage-types-bar" aria-hidden="true">
        {present.map((type) => (
          <span
            key={type}
            className={`storage-type-segment is-${type}`}
            style={{ flexGrow: byType[type].bytes }}
          />
        ))}
      </div>
      <ul className="storage-types-legend">
        {present.map((type) => (
          <li key={type}>
            <span className={`storage-type-swatch is-${type}`} aria-hidden="true" />
            <span className="storage-type-name">{t(`storage.types.${type}`)}</span>
            <span className="storage-type-size">
              {formatFileSize(byType[type].bytes, i18n.language)}
            </span>
            <span className="storage-type-note">
              {percent.format(byType[type].bytes / totalBytes)} ·{' '}
              {t('storage.files', { count: byType[type].count })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
