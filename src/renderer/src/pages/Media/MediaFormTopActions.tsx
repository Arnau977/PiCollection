import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import type { MediaModel } from '@shared/models'
import type { QueueInfo } from './MediaForm.types'

interface MediaFormTopActionsProps {
  media?: MediaModel
  queueInfo?: QueueInfo
  queueSavedMedia?: MediaModel
  isEditing: boolean
  saving: boolean
  hasExactDuplicate: boolean
  onCancel: () => void
  onMarkResolved?: () => void
  onMarkResolvedClick: () => void
  onSendToPending: () => void
}

/**
 * Cancel/Guardar/Anterior/Siguiente/Enviar-a-pending - kept in a fixed top
 * bar (not at the bottom of the form) so it stays in a constant spot
 * regardless of how many tags/characters/series the current item has,
 * instead of jumping position on every file switch in the pending queue.
 */
export function MediaFormTopActions({
  media,
  queueInfo,
  queueSavedMedia,
  isEditing,
  saving,
  hasExactDuplicate,
  onCancel,
  onMarkResolved,
  onMarkResolvedClick,
  onSendToPending
}: MediaFormTopActionsProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="media-page-actions media-form-top-actions">
      <div className="media-form-top-actions-left">
        <button type="button" className="btn" onClick={onCancel}>
          <ArrowLeft size={16} />
          {queueInfo ? t('importQueue.close') : t('manage.cancel')}
        </button>
        {media?.pendingTagging && onMarkResolved && (
          <button type="button" className="btn" onClick={onMarkResolvedClick}>
            {t('media.markResolved')}
          </button>
        )}
      </div>
      <div className="media-form-top-actions-right">
        {queueInfo?.onPrevious && (
          <button type="button" className="btn" onClick={queueInfo.onPrevious}>
            <ChevronLeft size={16} />
            {t('importQueue.previous')}
          </button>
        )}
        <button
          type="submit"
          form="media-form"
          className="btn btn-primary"
          disabled={saving || hasExactDuplicate}
        >
          {saving
            ? t('media.saving')
            : queueInfo || isEditing
              ? t('manage.save')
              : t('addMedia.submit')}
        </button>
        {queueInfo && (
          <button type="button" className="btn" onClick={queueInfo.onNext}>
            {t('importQueue.next')}
            <ChevronRight size={16} />
          </button>
        )}
        {queueInfo && !media && !queueSavedMedia && (
          <button type="button" className="btn" onClick={onSendToPending} disabled={saving}>
            {t('importQueue.sendToPending')}
          </button>
        )}
      </div>
    </div>
  )
}
