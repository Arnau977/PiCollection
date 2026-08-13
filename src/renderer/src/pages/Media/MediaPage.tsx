import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import type { MediaFilters, Sorting } from '@shared/models'
import Media from '../../components/Media'
import { MediaFileActions } from '../../components/MediaFileActions/MediaFileActions'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { useMediaById } from '../../hooks/useMediaById'
import { useAdjacentMedia } from '../../hooks/useAdjacentMedia'
import { MediaForm } from './MediaForm'
import './MediaPage.css'

const TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

const PENDING_QUEUE_OVERRIDE: { filters: MediaFilters; sorting: Sorting } = {
  filters: { pendingTagging: true },
  sorting: { prop: 'createdAt', desc: false }
}

const MediaPage: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const pendingQueue = Boolean((location.state as { pendingQueue?: boolean } | null)?.pendingQueue)
  const { data: media, loading, error, refetch } = useMediaById(id)
  const { previousId, nextId, index, total } = useAdjacentMedia(
    id,
    pendingQueue ? PENDING_QUEUE_OVERRIDE : undefined
  )
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [isEditing, setIsEditing] = useState(() => pendingQueue)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
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
    setDeleting(true)
    const result = await window.api.media.delete(mediaId)
    if (result.success) {
      navigate(PATH.GALLERY)
    } else {
      setDeleteError(result.error.message)
      setDeleting(false)
    }
  }

  // Hopping between media items always replaces the current history entry
  // instead of pushing a new one - otherwise flipping through several images
  // (arrow keys, prev/next zones, or the pending queue's Skip/Save & next)
  // pushes one entry per hop, and "Back to gallery" (navigate(-1)) would only
  // undo a single hop instead of returning to wherever the browsing session
  // actually started (Gallery, the pending entry point, etc).
  function goToMedia(nextMediaId: string): void {
    const path = PATH.MEDIA.replace(':id', nextMediaId)
    if (pendingQueue) {
      navigate(path, { state: { pendingQueue: true }, replace: true })
    } else {
      navigate(path, { replace: true })
    }
  }

  // Shared "what's next" routing for every way of moving past the current
  // pending item: marking it resolved, saving it (Save & next), or skipping
  // it outright - all three want the same target (next pending item, or the
  // gallery once the queue is exhausted) regardless of which one triggered it.
  function advanceQueue(): void {
    if (pendingQueue && nextId) {
      goToMedia(nextId)
    } else if (pendingQueue) {
      navigate(PATH.GALLERY)
    } else {
      refetch()
    }
  }

  async function handleMarkResolved(): Promise<void> {
    if (!media) return
    const result = await window.api.media.clearPendingTagging(media.id)
    if (result.success) advanceQueue()
  }

  const queueInfo =
    pendingQueue && index !== null && total !== null
      ? { current: index + 1, total, onSkip: advanceQueue }
      : undefined

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
    <div className="page media-page">
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
          {media.pendingTagging && (
            <button type="button" className="btn" onClick={handleMarkResolved}>
              {t('media.markResolved')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleting}
            onClick={() => handleDelete(media.id)}
          >
            <Trash2 size={16} />
            {deleting ? t('media.deleting') : t('media.delete')}
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
            key={media.id}
            media={media}
            queueInfo={queueInfo}
            onCancel={() => setIsEditing(false)}
            onSaved={() => {
              if (pendingQueue) {
                advanceQueue()
              } else {
                setIsEditing(false)
                refetch()
              }
            }}
            onMarkResolved={advanceQueue}
          />
        ) : (
          <Media {...media} previousId={previousId} nextId={nextId} onNavigate={goToMedia} />
        )}
      </div>
    </div>
  )
}

export default MediaPage
