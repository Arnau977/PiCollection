import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PATH } from '../../app.routes.const'
import { DiscardedManager } from './DiscardedManager'
import '../Manage/ManagePage.css'
import './DiscardedPage.css'

/** Reached from Disk space's Reclaimable card: this is where that space is won back. */
export default function DiscardedPage(): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="page manage-page">
      <div className="discarded-page-header">
        <button type="button" className="btn" onClick={() => navigate(PATH.STORAGE)}>
          <ArrowLeft size={16} />
          {t('discarded.backToStorage')}
        </button>
        <h1 className="page-title">{t('discarded.title')}</h1>
      </div>

      <div className="card manage-content">
        <DiscardedManager />
      </div>
    </div>
  )
}
