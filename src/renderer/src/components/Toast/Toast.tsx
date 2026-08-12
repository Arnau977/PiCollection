import { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './Toast.css'

interface ToastProps {
  message: string
  actionLabel?: string
  onAction?: () => void
  onDismiss: () => void
  durationMs?: number
}

const DEFAULT_DURATION_MS = 6000

export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = DEFAULT_DURATION_MS
}: ToastProps): JSX.Element {
  const { t } = useTranslation()

  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs)
    return (): void => clearTimeout(timer)
  }, [onDismiss, durationMs])

  return (
    <div className="toast" role="status">
      <CheckCircle2 size={18} className="toast-icon" aria-hidden="true" />
      <p className="toast-message">{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn toast-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        className="icon-btn toast-dismiss"
        aria-label={t('media.closeLightbox')}
        onClick={onDismiss}
      >
        <X size={14} />
      </button>
    </div>
  )
}
