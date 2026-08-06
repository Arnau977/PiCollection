import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConfirmOptions } from './ConfirmDialogContext'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  options: ConfirmOptions
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ options, onConfirm, onCancel }: ConfirmDialogProps): JSX.Element {
  const { t } = useTranslation()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return (): void => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div className="confirm-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={options.title ?? options.message}
      >
        {options.title && <h3 className="confirm-dialog-title">{options.title}</h3>}
        <p className="confirm-dialog-message">{options.message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn" ref={cancelRef} onClick={onCancel}>
            {options.cancelLabel ?? t('confirmDialog.cancel')}
          </button>
          <button
            type="button"
            className={options.danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
          >
            {options.confirmLabel ?? t('confirmDialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
