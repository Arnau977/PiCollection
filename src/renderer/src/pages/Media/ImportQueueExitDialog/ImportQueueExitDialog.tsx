import { useTranslation } from 'react-i18next'
import '../../../components/ConfirmDialog/ConfirmDialog.css'

interface ImportQueueExitDialogProps {
  remaining: number
  onAddToPending: () => void
  onDiscard: () => void
  onKeepEditing: () => void
}

export function ImportQueueExitDialog({
  remaining,
  onAddToPending,
  onDiscard,
  onKeepEditing
}: ImportQueueExitDialogProps): JSX.Element {
  const { t } = useTranslation()

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onKeepEditing()
  }

  return (
    <div className="confirm-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('importQueue.exitDialogTitle')}
      >
        <h3 className="confirm-dialog-title">{t('importQueue.exitDialogTitle')}</h3>
        <p className="confirm-dialog-message">
          {t('importQueue.exitDialogMessage', { count: remaining })}
        </p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn" onClick={onKeepEditing}>
            {t('importQueue.exitDialogKeepEditing')}
          </button>
          <button type="button" className="btn" onClick={onDiscard}>
            {t('importQueue.exitDialogDiscard')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onAddToPending}>
            {t('importQueue.exitDialogAddToPending')}
          </button>
        </div>
      </div>
    </div>
  )
}
