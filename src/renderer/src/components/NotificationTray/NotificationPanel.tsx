import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BellOff, Info } from 'lucide-react'
import type { AppNotification, AppNotificationKind } from '@shared/models'
import { EmptyState } from '../EmptyState/EmptyState'
import { notificationRow } from './notificationRows'

interface NotificationPanelProps {
  items: AppNotification[]
  onSnooze: (kind: AppNotificationKind) => void
  onClose: () => void
}

export function NotificationPanel({
  items,
  onSnooze,
  onClose
}: NotificationPanelProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  if (items.length === 0) {
    return <EmptyState icon={<BellOff />} title={t('notifications.empty')} />
  }

  return (
    <ul className="notification-list">
      {items.map((item) => {
        const row = notificationRow(item, t, i18n.language)
        const Icon = item.severity === 'attention' ? AlertTriangle : Info
        return (
          <li key={item.kind} className={`notification-row is-${item.severity}`}>
            <Icon size={18} className="notification-icon" aria-hidden="true" />
            <div className="notification-text">
              <p className="notification-title">{row.title}</p>
              {row.detail && <p className="notification-detail">{row.detail}</p>}
            </div>
            <div className="notification-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onClose()
                  navigate(row.to, { state: row.state })
                }}
              >
                {row.actionLabel}
              </button>
              {item.snoozable && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('notifications.snooze')}
                  title={t('notifications.snooze')}
                  onClick={() => onSnooze(item.kind)}
                >
                  <BellOff size={15} />
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
