import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '@renderer/app.routes.const'
import { MediaForm } from './MediaForm'
import './AddMediaPage.css'

export default function AddMediaPage(): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="page add-media-page">
      <h1>{t('addMedia.title')}</h1>
      <MediaForm
        onCancel={() => navigate(PATH.GALLERY)}
        onSaved={(created) => navigate(PATH.MEDIA.replace(':id', created.id))}
      />
    </div>
  )
}
