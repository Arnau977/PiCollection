import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import Media from '../../components/Media'
import { MediaFileActions } from '../../components/MediaFileActions/MediaFileActions'
import { useMediaById } from '../../hooks/useMediaById'
import { useAdjacentMedia } from '../../hooks/useAdjacentMedia'
import { MediaForm } from './MediaForm'
import './MediaPage.css'

const CLICK_THROUGH_SELECTOR = '.media-detail-media, .media-detail-info, .media-page-actions'
const TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

const MediaPage: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { data: media, loading, error, refetch } = useMediaById(id)
  const { previousId, nextId } = useAdjacentMedia(id)
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)

  function goToGallery(): void {
    navigate(PATH.GALLERY)
  }

  function goToMedia(nextMediaId: string): void {
    navigate(PATH.MEDIA.replace(':id', nextMediaId))
  }

  useEffect(() => {
    if (isEditing) return

    function handleKeyDown(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null
      if (target && (TEXT_INPUT_TAGS.has(target.tagName) || target.isContentEditable)) return

      if (e.key === 'ArrowLeft' && previousId) goToMedia(previousId)
      else if (e.key === 'ArrowRight' && nextId) goToMedia(nextId)
    }

    document.addEventListener('keydown', handleKeyDown)
    return (): void => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goToMedia/navigate are stable for the lifetime of this component
  }, [isEditing, previousId, nextId])

  function handleBackgroundClick(e: React.MouseEvent<HTMLDivElement>): void {
    const target = e.target as HTMLElement
    if (target.closest(CLICK_THROUGH_SELECTOR)) return
    goToGallery()
  }

  if (loading) {
    return (
      <div className="page">
        <p className="loading-state">{t('gallery.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <p role="alert">{error}</p>
      </div>
    )
  }

  if (!media) {
    return (
      <div className="page">
        <p>{t('media.notFound')}</p>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className="page media-page">
        <MediaForm
          media={media}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false)
            refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="page media-page" onClick={handleBackgroundClick}>
      <div className="media-page-actions">
        <button type="button" className="btn media-page-back" onClick={goToGallery}>
          <ArrowLeft size={16} />
          {t('gallery.backToGallery')}
        </button>
        <button type="button" className="btn" onClick={() => setIsEditing(true)}>
          <Pencil size={16} />
          {t('media.edit')}
        </button>
        <MediaFileActions route={media.route} type={media.type} />
      </div>
      <Media {...media} previousId={previousId} nextId={nextId} onNavigate={goToMedia} />
    </div>
  )
}

export default MediaPage
