import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Images, Inbox, Database, Settings } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import { useAppUpdater } from '../../hooks/useAppUpdater'
import { useEntityCacheSync } from '../../hooks/useEntityLists'
import { Toast } from '../Toast/Toast'
import './AppHeader.css'

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-sidebar-link active' : 'app-sidebar-link'
}

function withExtraActive(extraActive: boolean) {
  return ({ isActive }: { isActive: boolean }): string =>
    isActive || extraActive ? 'app-sidebar-link active' : 'app-sidebar-link'
}

// A media detail page (/media/:id) isn't nested under /gallery or /pending
// in the route tree, so it never matches either NavLink by path alone -
// highlight whichever one it was actually opened from instead, using the
// `pendingQueue` flag MediaPage's own navigation already carries in
// location.state (see MediaPage.tsx's goToMedia/pendingQueue).
const MEDIA_DETAIL_PATTERN = /^\/media\/(?!add$)/

export function AppHeader(): JSX.Element {
  const { t } = useTranslation()
  const { status } = useAppUpdater()
  const location = useLocation()
  const navigate = useNavigate()
  const updateReady = status.state === 'available' || status.state === 'downloaded'
  useEntityCacheSync()

  // The badge stays up for as long as an update is pending, but the toast is
  // a one-time nudge - once dismissed (by the user, or by its own auto-hide
  // timer), it shouldn't come back just because a later background check
  // re-confirms the same update is still available.
  const [updateToastDismissed, setUpdateToastDismissed] = useState(false)
  const showUpdateToast = status.state === 'available' && !updateToastDismissed

  const isMediaDetail = MEDIA_DETAIL_PATTERN.test(location.pathname)
  const fromPendingQueue = Boolean(
    (location.state as { pendingQueue?: boolean } | null)?.pendingQueue
  )

  return (
    <aside className="app-sidebar">
      <NavLink to={PATH.HOME} className="app-brand" end>
        <span className="app-brand-mark" aria-hidden="true">
          π
        </span>
        <span className="app-brand-text">PiCollection</span>
      </NavLink>

      <nav className="app-sidebar-nav">
        <NavLink to={PATH.HOME} className={navLinkClassName} end title={t('nav.home')}>
          <Home size={19} aria-hidden="true" />
          <span className="app-sidebar-label">{t('nav.home')}</span>
        </NavLink>
        <NavLink
          to={PATH.GALLERY}
          className={withExtraActive(isMediaDetail && !fromPendingQueue)}
          title={t('nav.gallery')}
        >
          <Images size={19} aria-hidden="true" />
          <span className="app-sidebar-label">{t('nav.gallery')}</span>
        </NavLink>
        <NavLink
          to={PATH.PENDING}
          className={withExtraActive(isMediaDetail && fromPendingQueue)}
          title={t('nav.pending')}
        >
          <Inbox size={19} aria-hidden="true" />
          <span className="app-sidebar-label">{t('nav.pending')}</span>
        </NavLink>
        <NavLink to={PATH.MANAGE} className={navLinkClassName} title={t('nav.manage')}>
          <Database size={19} aria-hidden="true" />
          <span className="app-sidebar-label">{t('nav.manage')}</span>
        </NavLink>
        <NavLink to={PATH.SETTINGS} className={navLinkClassName} title={t('nav.settings')}>
          <span className="app-sidebar-icon-wrap">
            <Settings size={19} aria-hidden="true" />
            {updateReady && <span className="app-sidebar-badge" aria-hidden="true" />}
          </span>
          <span className="app-sidebar-label">{t('nav.settings')}</span>
        </NavLink>
      </nav>

      {status.state === 'available' && showUpdateToast && (
        <Toast
          message={t('settings.updateAvailable', { version: status.version })}
          actionLabel={t('settings.updateToastView')}
          onAction={() => {
            setUpdateToastDismissed(true)
            navigate(PATH.SETTINGS)
          }}
          onDismiss={() => setUpdateToastDismissed(true)}
        />
      )}
    </aside>
  )
}
