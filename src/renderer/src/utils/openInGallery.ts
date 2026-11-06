import type { FilterListModel, MediaFilters, Sorting } from '@shared/models'
import { PATH } from '../app.routes.const'
import { readGallerySession, writeGallerySession } from '../hooks/useGallerySession'
import { beginListEdit } from '../pages/Gallery/listEdit'
import { loadGalleryDefaults } from './gallerySettings'

export type CountEntityKind = 'artist' | 'tag' | 'character' | 'series'

function filterFor(kind: CountEntityKind, id: string): MediaFilters {
  if (kind === 'artist') return { artistId: id }
  if (kind === 'tag') return { tagGroups: [[id]] }
  // Character/series groups match descendants too, same as the rolled-up counts shown for them.
  if (kind === 'character') return { characterGroups: [[id]] }
  return { seriesGroups: [[id]] }
}

/**
 * Opens the gallery with these filters. Replaces whatever gallery filters
 * were active; the SFW/type defaults still apply, so a "safe by default"
 * gallery isn't bypassed by a click. `sorting` overrides the current order
 * (the Storage page opens it heaviest first).
 */
export function openGalleryFiltered(
  filters: MediaFilters,
  navigate: (path: string) => void,
  sorting?: Sorting
): void {
  const defaults = loadGalleryDefaults()
  writeGallerySession({
    filters: { sfw: defaults.sfw, type: defaults.type, ...filters },
    sorting: sorting ??
      readGallerySession()?.sorting ?? { prop: defaults.sortProp, desc: defaults.sortDesc },
    page: 0
  })
  navigate(PATH.GALLERY)
}

/** Opens the gallery with `list` applied and already open for editing. */
export function openListEditInGallery(
  list: FilterListModel,
  navigate: (path: string) => void
): void {
  const defaults = loadGalleryDefaults()
  writeGallerySession({
    ...beginListEdit(
      list,
      { sfw: defaults.sfw, type: defaults.type, filterListIds: [list.id] },
      defaults
    ),
    sorting: readGallerySession()?.sorting ?? { prop: defaults.sortProp, desc: defaults.sortDesc },
    page: 0
  })
  navigate(PATH.GALLERY)
}

/** Opens the gallery filtered to one entity (see openGalleryFiltered). */
export function openEntityInGallery(
  kind: CountEntityKind,
  id: string,
  navigate: (path: string) => void,
  sorting?: Sorting
): void {
  openGalleryFiltered(filterFor(kind, id), navigate, sorting)
}
