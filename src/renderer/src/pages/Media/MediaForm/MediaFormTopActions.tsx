import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import type { MediaModel } from '@shared/models'
import type { QueueInfo } from './MediaForm.types'

interface MediaFormTopActionsProps {
  media?: MediaModel
  queueInfo?: QueueInfo
  queueSavedMedia?: MediaModel
  isEditing: boolean
  saving: boolean
  deleting?: boolean
  hasExactDuplicate: boolean
  onCancel: () => void
  onMarkResolved?: () => void
  onMarkResolvedClick: () => void
  onSendToPending: () => void
  onDelete?: () => void
}

/**
 * Cancel/Guardar/Anterior/Siguiente/Marcar-resuelto/Enviar-a-pending - kept
 * in a fixed top bar (not at the bottom of the form) so it stays in a
 * constant spot regardless of how many tags/characters/series the current
 * item has, instead of jumping position on every file switch in the queue.
 *
 * Grouped by intent rather than left/right-by-button-count: Cancel is the
 * only action that discards, so it stands alone. Anterior/Siguiente are a
 * single "browse the queue" gesture and stay paired, never split by Guardar
 * the way they used to be. Marcar resuelto and Enviar a pendientes are both
 * secondary "commit" actions (resolve-and-advance / defer-and-advance) - each
 * only ever applies to one of the two entry points (existing pending media
 * vs. a brand-new queued file), so they share a slot next to the primary
 * Guardar instead of each needing their own case.
 *
 * Eliminar is only offered for pending media (the pending queue opens
 * straight into this form, so it never shows MediaPage's view-mode bar) and
 * sits last behind a divider, mirroring where that bar keeps its own
 * destructive action.
 */
export function MediaFormTopActions({
  media,
  queueInfo,
  queueSavedMedia,
  isEditing,
  saving,
  deleting = false,
  hasExactDuplicate,
  onCancel,
  onMarkResolved,
  onMarkResolvedClick,
  onSendToPending,
  onDelete
}: MediaFormTopActionsProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="media-page-actions media-form-top-actions">
      <button type="button" className="btn" onClick={onCancel}>
        <ArrowLeft size={16} />
        {queueInfo ? t('importQueue.close') : t('manage.cancel')}
      </button>

      <div className="media-form-top-actions-right">
        {queueInfo && (
          <>
            <div className="action-group">
              {queueInfo.onPrevious && (
                <button type="button" className="btn" onClick={queueInfo.onPrevious}>
                  <ChevronLeft size={16} />
                  {t('importQueue.previous')}
                </button>
              )}
              <button type="button" className="btn" onClick={queueInfo.onNext}>
                {t('importQueue.next')}
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="action-divider" />
          </>
        )}
        <div className="action-group">
          {media?.pendingTagging && onMarkResolved && (
            <button
              type="button"
              className="btn"
              onClick={onMarkResolvedClick}
              disabled={deleting || saving || hasExactDuplicate}
            >
              {t('media.saveAndResolve')}
            </button>
          )}
          {/* Stays mounted (collapsed via CSS, not unmounted) once queueSavedMedia
              is set, so the action bar shrinks smoothly instead of the primary
              Guardar button jumping left the instant this disappears. */}
          {queueInfo && !media && (
            <button
              type="button"
              className={`btn media-form-send-to-pending${queueSavedMedia ? ' is-collapsed' : ''}`}
              onClick={onSendToPending}
              disabled={saving || Boolean(queueSavedMedia)}
              aria-hidden={queueSavedMedia ? true : undefined}
              tabIndex={queueSavedMedia ? -1 : undefined}
            >
              {t('importQueue.sendToPending')}
            </button>
          )}
          <button
            type="submit"
            form="media-form"
            className="btn btn-primary"
            disabled={saving || deleting || hasExactDuplicate}
          >
            {saving
              ? t('media.saving')
              : queueInfo || isEditing
                ? t('manage.save')
                : t('addMedia.submit')}
          </button>
        </div>
        {media?.pendingTagging && onDelete && (
          <>
            <div className="action-divider" />
            <button
              type="button"
              className="btn btn-danger"
              onClick={onDelete}
              disabled={saving || deleting}
            >
              <Trash2 size={16} />
              {deleting ? t('media.deleting') : t('media.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
