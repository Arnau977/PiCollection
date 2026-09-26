import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox } from 'lucide-react'
import type { MediaDuplicateCheck, MediaInput, MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { Lightbox } from '../../../components/Lightbox/Lightbox'
import { MediaFileActions } from '../../../components/MediaFileActions/MediaFileActions'
import { MediaHoverPreview } from '../../../components/MediaHoverPreview/MediaHoverPreview'
import type { InitialFile, QueueInfo } from './MediaForm.types'

/**
 * Where the file lives on disk - file name first (what the user recognizes),
 * folder second, both truncated with the full path on hover. Routes may be
 * stored relative to the source folder; the actions resolve that themselves.
 */
function MediaFileLocation({
  route,
  type
}: {
  route: string
  type: MediaModel['type']
}): JSX.Element {
  const { t } = useTranslation()
  const lastSeparator = Math.max(route.lastIndexOf('/'), route.lastIndexOf('\\'))
  const fileName = route.slice(lastSeparator + 1)
  const folder = lastSeparator > 0 ? route.slice(0, lastSeparator) : ''

  return (
    <div className="media-form-file-location">
      <div className="media-form-file-location-text" title={route}>
        <span className="media-form-file-location-label">{t('addMedia.fileLocation')}</span>
        <span className="media-form-file-location-name">{fileName}</span>
        {folder && <span className="media-form-file-location-folder">{folder}</span>}
      </div>
      <MediaFileActions route={route} type={type} />
    </div>
  )
}

interface MediaFormFileGroupProps {
  queueInfo?: QueueInfo
  isEditing: boolean
  initialFile?: InitialFile
  media?: MediaModel
  input: MediaInput
  duplicateCheck: MediaDuplicateCheck | null
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function MediaFormFileGroup({
  queueInfo,
  isEditing,
  initialFile,
  media,
  input,
  duplicateCheck,
  onFileChange
}: MediaFormFileGroupProps): JSX.Element {
  const { t } = useTranslation()
  // Only images/gifs open the Lightbox on click - video already has native
  // controls (play/fullscreen), and layering the Lightbox on top of an
  // already-playing video used to start a second, independent playback (see
  // the same tradeoff in Media.tsx).
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const previewMedia =
    isEditing && media
      ? { src: toMediaUrl(media.route), type: media.type, alt: media.name, route: media.route }
      : !isEditing && input.route
        ? { src: toMediaUrl(input.route), type: input.type, alt: '', route: input.route }
        : null

  return (
    <div className="media-form-group">
      <h2>{t('addMedia.groupFile')}</h2>
      {queueInfo && (
        <div className="import-queue-progress">
          <span>
            {t('importQueue.progress', { current: queueInfo.current, total: queueInfo.total })}
          </span>
          {/* A whole-batch action, so it sits with the batch's progress rather
              than in the top bar, whose buttons all act on the current file. */}
          {queueInfo.onSendRemainingToPending && (
            <button type="button" className="btn" onClick={queueInfo.onSendRemainingToPending}>
              <Inbox size={14} />
              {t('importQueue.sendRemainingToPending', {
                count: queueInfo.total - queueInfo.current + 1
              })}
            </button>
          )}
        </div>
      )}

      {!isEditing && !initialFile && (
        <div className="field">
          <label htmlFor="media-file">{t('addMedia.file')}</label>
          <input
            id="media-file"
            type="file"
            accept="image/*,video/*,.gif"
            onChange={onFileChange}
            required
          />
        </div>
      )}

      {previewMedia && (
        <div className="media-preview">
          {previewMedia.type === 'video' ? (
            <video muted controls src={previewMedia.src} />
          ) : (
            <img
              src={previewMedia.src}
              alt={previewMedia.alt}
              onClick={() => setLightboxOpen(true)}
            />
          )}
        </div>
      )}
      {isEditing && media && <MediaFileLocation route={media.route} type={media.type} />}
      {lightboxOpen && previewMedia && (
        <Lightbox
          src={previewMedia.src}
          type={previewMedia.type}
          alt={previewMedia.alt}
          route={previewMedia.route}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {duplicateCheck?.exactMatch && (
        <p role="alert" className="duplicate-error">
          {t('addMedia.duplicateExact', { name: duplicateCheck.exactMatch.name })}
        </p>
      )}
      {!duplicateCheck?.exactMatch && duplicateCheck && duplicateCheck.similar.length > 0 && (
        <div className="duplicate-warning">
          <p>{t('addMedia.duplicateSimilar')}</p>
          <ul className="chip-list">
            {duplicateCheck.similar.map(({ media: similarMedia, distance }) => (
              <li key={similarMedia.id}>
                <MediaHoverPreview media={similarMedia}>{similarMedia.name}</MediaHoverPreview> (
                {t('addMedia.duplicateSimilarMatch', { distance })})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
