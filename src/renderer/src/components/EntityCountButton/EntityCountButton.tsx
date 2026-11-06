import { useTranslation } from 'react-i18next'
import { useOpenInGallery } from '../../hooks/useOpenInGallery'
import { formatCompactCount } from '../../utils/formatCompactCount'
import type { CountEntityKind } from '../../utils/openInGallery'
import './EntityCountButton.css'

interface EntityCountButtonProps {
  kind: CountEntityKind
  id: string
  name: string
  count: number
}

/**
 * A metadata row's media count that opens the gallery filtered to that entity.
 * Replaces whatever gallery filters were active; the SFW/type defaults still
 * apply, so a "safe by default" gallery isn't bypassed by a click.
 */
export function EntityCountButton({ kind, id, name, count }: EntityCountButtonProps): JSX.Element {
  const { t } = useTranslation()
  const { openEntity } = useOpenInGallery()
  const label = formatCompactCount(count)

  if (count === 0) return <span className="manage-item-count">{label}</span>

  const title = t('manage.showInGallery', { count, name })
  return (
    <button
      type="button"
      className="manage-item-count entity-count-button"
      aria-label={title}
      title={title}
      onClick={() => void openEntity(kind, id)}
    >
      {label}
    </button>
  )
}
