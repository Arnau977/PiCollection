import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '@renderer/app.routes.const'
import './AppHeader.css'

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'active' : ''
}

export function AppHeader(): JSX.Element {
  const { t } = useTranslation()

  return (
    <header className="app-header">
      <NavLink to={PATH.HOME} className="app-brand" end>
        PiCollection
      </NavLink>
      <nav>
        <NavLink to={PATH.HOME} className={navLinkClassName} end>
          {t('nav.home')}
        </NavLink>
        <NavLink to={PATH.GALLERY} className={navLinkClassName}>
          {t('nav.gallery')}
        </NavLink>
        <NavLink to={PATH.MANAGE} className={navLinkClassName}>
          {t('nav.manage')}
        </NavLink>
        <NavLink to={PATH.SETTINGS} className={navLinkClassName}>
          {t('nav.settings')}
        </NavLink>
      </nav>
    </header>
  )
}
