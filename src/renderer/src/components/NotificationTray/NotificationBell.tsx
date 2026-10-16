import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components'
import { useNotifications } from '../../hooks/useNotifications'
import { NotificationPanel } from './NotificationPanel'
import './NotificationTray.css'

/**
 * Sidebar bell: count badge plus a popover listing what still needs doing.
 * Opens beside the sidebar (`end bottom`) rather than over the content.
 */
export function NotificationBell(): JSX.Element {
  const { t } = useTranslation()
  const { items, snooze } = useNotifications()
  const [open, setOpen] = useState(false)
  const count = items.length
  const label = count ? t('notifications.bellLabelCount', { count }) : t('notifications.bellLabel')

  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button className="app-sidebar-link notification-bell" aria-label={label}>
        <span className="app-sidebar-icon-wrap">
          <Bell size={19} aria-hidden="true" />
          {count > 0 && (
            <span className="notification-badge" aria-hidden="true">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </span>
        <span className="app-sidebar-label" aria-hidden="true">
          {t('nav.notifications')}
        </span>
      </Button>
      <Popover placement="end bottom" className="notification-popover">
        <Dialog className="notification-dialog">
          <Heading slot="title" className="notification-heading">
            {t('notifications.panelTitle')}
          </Heading>
          <NotificationPanel
            items={items}
            onSnooze={(kind) => void snooze(kind)}
            onClose={() => setOpen(false)}
          />
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
