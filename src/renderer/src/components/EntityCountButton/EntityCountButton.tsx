import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { MediaFilters, Sorting } from '@shared/models'
import { PATH } from '../../app.routes.const'
import { readGallerySession, writeGallerySession } from '../../hooks/useGallerySession'
import { formatCompactCount } from '../../utils/formatCompactCount'
import { loadGalleryDefaults } from '../../utils/gallerySettings'
import './EntityCountButton.css'

export type CountEntityKind = 'artist' | 'tag' | 'character' | 'series'

function filterFor(kind: CountEntityKind, id: string): MediaFilters {
  if (kind === 'artist') return { artistId: id }
  if (kind === 'tag') return { tagGroups: [[id]] }
  // Character/series groups match descendants too, same as the rolled-up counts shown for them.
  if (kind === 'character') return { characterGroups: [[id]] }
  return { seriesGroups: [[id]] }
}

/**
 * Opens the gallery filtered to one entity. Replaces whatever gallery filters
 * were active; the SFW/type defaults still apply, so a "safe by default"
 * gallery isn't bypassed by a click. `sorting` overrides the current order
 * (the Storage page opens it heaviest first).
 */
export function openEntityInGallery(
  kind: CountEntityKind,
  id: string,
  navigate: (path: string) => void,
  sorting?: Sorting
): void {
  const defaults = loadGalleryDefaults()
  writeGallerySession({
    filters: { sfw: defaults.sfw, type: defaults.type, ...filterFor(kind, id) },
    sorting: sorting ??
      readGallerySession()?.sorting ?? { prop: defaults.sortProp, desc: defaults.sortDesc },
    page: 0
  })
  navigate(PATH.GALLERY)
}

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
