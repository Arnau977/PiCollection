import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { formatCompactCount } from '../../utils/formatCompactCount'
import { openEntityInGallery, type CountEntityKind } from '../../utils/openInGallery'
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
  const navigate = useNavigate()
  const label = formatCompactCount(count)

  if (count === 0) return <span className="manage-item-count">{label}</span>

  function openInGallery(): void {
    openEntityInGallery(kind, id, navigate)
  }

  const title = t('manage.showInGallery', { count, name })
  return (
    <button
      type="button"
      className="manage-item-count entity-count-button"
      aria-label={title}
      title={title}
      onClick={openInGallery}
    >
      {label}
    </button>
  )
}
