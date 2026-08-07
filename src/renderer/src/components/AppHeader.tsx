import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Images, Database, Settings } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import { useAppUpdater } from '../hooks/useAppUpdater'
import './AppHeader.css'

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-sidebar-link active' : 'app-sidebar-link'
}

export function AppHeader(): JSX.Element {
  const { t } = useTranslation()
  const { status } = useAppUpdater()
  const updateReady = status.state === 'available' || status.state === 'downloaded'

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
        <NavLink to={PATH.GALLERY} className={navLinkClassName} title={t('nav.gallery')}>
          <Images size={19} aria-hidden="true" />
          <span className="app-sidebar-label">{t('nav.gallery')}</span>
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
    </aside>
  )
}
