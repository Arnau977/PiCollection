import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { FilterListModel, MediaFilters, Sorting } from '@shared/models'
import { PATH } from '../app.routes.const'
import { useConfirm } from '../components/ConfirmDialog/ConfirmDialogContext'
import { hasListEditChanges } from '../pages/Gallery/listEdit'
import {
  openEntityInGallery,
  openGalleryFiltered,
  openListEditInGallery,
  type CountEntityKind
} from '../utils/openInGallery'
import { readGallerySession } from './useGallerySession'

interface OpenInGallery {
  openFiltered: (filters: MediaFilters, sorting?: Sorting) => Promise<void>
  openEntity: (kind: CountEntityKind, id: string, sorting?: Sorting) => Promise<void>
  openListEdit: (list: FilterListModel) => Promise<void>
}

/**
 * The openInGallery actions for a click. Each replaces the gallery's session,
 * so a list edit with changes asks first; with nothing to lose, no dialog.
 */
export function useOpenInGallery(): OpenInGallery {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()

  async function mayReplaceSession(): Promise<boolean> {
    const session = readGallerySession()
    if (!session?.listEdit || !hasListEditChanges(session.filters, session.listEdit)) return true
    return confirm({
      message: t('filterLists.discardEditConfirm', { name: session.listEdit.name }),
      confirmLabel: t('media.discardChanges'),
      cancelLabel: t('filterLists.keepEditing'),
      danger: true
    })
  }

  return {
    openFiltered: async (filters, sorting): Promise<void> => {
      if (await mayReplaceSession()) openGalleryFiltered(filters, navigate, sorting)
    },
    openEntity: async (kind, id, sorting): Promise<void> => {
      if (await mayReplaceSession()) openEntityInGallery(kind, id, navigate, sorting)
    },
    openListEdit: async (list): Promise<void> => {
      if (readGallerySession()?.listEdit?.id === list.id) navigate(PATH.GALLERY)
      else if (await mayReplaceSession()) openListEditInGallery(list, navigate)
    }
  }
}
