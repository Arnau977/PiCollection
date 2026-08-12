import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import Media from '../../components/Media'
import { MediaFileActions } from '../../components/MediaFileActions/MediaFileActions'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
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
  const confirm = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const scrollRegionRef = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef(0)

  // Entering edit mode swaps in much shorter form content, which clamps the
  // scroll region back to 0 - restore the view's scroll position once we're
  // back so saving/cancelling an edit doesn't dump the user at the top.
  useLayoutEffect(() => {
    if (!isEditing && scrollRegionRef.current) {
      scrollRegionRef.current.scrollTop = savedScrollTop.current
    }
  }, [isEditing])

  function startEditing(): void {
    savedScrollTop.current = scrollRegionRef.current?.scrollTop ?? 0
    setIsEditing(true)
  }

  function goBack(): void {
    // A deep link or direct navigation leaves no in-app history to return to.
    if (window.history.length > 1) navigate(-1)
    else navigate(PATH.GALLERY)
  }

  async function handleDelete(mediaId: string): Promise<void> {
    const ok = await confirm({ message: t('media.confirmDelete'), danger: true })
    if (!ok) return
    const result = await window.api.media.delete(mediaId)
    if (result.success) {
      navigate(PATH.GALLERY)
    } else {
      setDeleteError(result.error.message)
    }
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
    goBack()
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

  return (
    <div className="page media-page" onClick={isEditing ? undefined : handleBackgroundClick}>
      {!isEditing && (
        <div className="media-page-actions">
          <button type="button" className="btn media-page-back" onClick={goBack}>
            <ArrowLeft size={16} />
            {t('gallery.backToGallery')}
          </button>
          <button type="button" className="btn" onClick={startEditing}>
            <Pencil size={16} />
            {t('media.edit')}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => handleDelete(media.id)}>
            <Trash2 size={16} />
            {t('media.delete')}
          </button>
          <MediaFileActions route={media.route} type={media.type} />
        </div>
      )}
      {deleteError && (
        <p role="alert" className="media-page-delete-error">
          {deleteError}
        </p>
      )}
      <div className="media-page-scroll-region" ref={scrollRegionRef}>
        {isEditing ? (
          <MediaForm
            media={media}
            onCancel={() => setIsEditing(false)}
            onSaved={() => {
              setIsEditing(false)
              refetch()
            }}
          />
        ) : (
          <Media {...media} previousId={previousId} nextId={nextId} onNavigate={goToMedia} />
        )}
      </div>
    </div>
  )
}

export default MediaPage
