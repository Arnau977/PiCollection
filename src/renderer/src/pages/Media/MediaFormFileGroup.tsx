import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaDuplicateCheck, MediaInput, MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { Lightbox } from '../../components/Lightbox/Lightbox'
import { MediaHoverPreview } from '../../components/MediaHoverPreview/MediaHoverPreview'
import type { InitialFile, QueueInfo } from './MediaForm.types'

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
        <p className="import-queue-progress">
          {t('importQueue.progress', { current: queueInfo.current, total: queueInfo.total })}
        </p>
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
