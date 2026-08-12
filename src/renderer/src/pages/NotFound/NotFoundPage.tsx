import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '@renderer/app.routes.const'
import './NotFoundPage.css'

export default function NotFoundPage(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="page not-found-page">
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.hint')}</p>
      <Link to={PATH.HOME} className="btn btn-primary">
        {t('notFound.backHome')}
      </Link>
    </div>
  )
}
