import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Replace } from 'lucide-react'
import type { MediaDuplicateMatch, MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { MediaCompare, type ComparedMedia } from '../../../components/MediaCompare/MediaCompare'
import { MediaHoverPreview } from '../../../components/MediaHoverPreview/MediaHoverPreview'
import { useSimilarMedia } from '../../../hooks/useSimilarMedia'
import { splitRoute } from '../../../utils/splitRoute'

/** The file being added/edited, compared against each match. */
export interface CurrentFile {
  route: string
  name: string
  type: MediaModel['type']
  /** Unset while the file is being added (not saved yet). */
  pendingTagging?: boolean
}

interface SimilarMediaWarningProps {
  matches: MediaDuplicateMatch[]
  title: string
  current?: CurrentFile
  /** "Replace with this file": the current file takes over that match. */
  onReplace?: (media: MediaModel) => void
  /** Locks the replace buttons while the form saves or replaces. */
  busy?: boolean
}

/** Non-blocking "looks similar to…" list, with a hover preview of each match. */
export function SimilarMediaWarning({
  matches,
  title,
  current,
  onReplace,
  busy = false
}: SimilarMediaWarningProps): JSX.Element | null {
  const { t } = useTranslation()
  const [compared, setCompared] = useState<ComparedMedia | null>(null)
  if (matches.length === 0) return null

  // A still frame can't be slid against a playing video, so videos keep just the hover preview.
  const canCompare = (media: MediaModel): boolean =>
    current !== undefined && current.type !== 'video' && media.type !== 'video'

  return (
    <div className="duplicate-warning">
      <p>{title}</p>
      <ul className="chip-list">
        {matches.map(({ media, distance, relation }) => (
          <li key={media.id} className="similar-match">
            <MediaHoverPreview
              media={media}
              onClick={
                canCompare(media)
                  ? (): void =>
                      setCompared({
                        src: toMediaUrl(media.route),
                        name: splitRoute(media.route).fileName,
                        status: media.pendingTagging ? 'pending' : 'library'
                      })
                  : undefined
              }
            >
              {splitRoute(media.route).fileName}
            </MediaHoverPreview>{' '}
            (
            {relation
              ? t(`media.relation.${relation}`)
              : t('addMedia.duplicateSimilarMatch', { distance })}
            {media.pendingTagging && ` · ${t('addMedia.similarPendingBadge')}`})
            {/* A GIF made from a video (relation) isn't a copy to swap. */}
            {onReplace && !relation && (
              <button
                type="button"
                className="btn similar-match-replace"
                onClick={() => onReplace(media)}
                disabled={busy}
                aria-label={t('addMedia.replaceLabel', { name: splitRoute(media.route).fileName })}
              >
                <Replace size={14} aria-hidden="true" />
                {t('addMedia.replace')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {compared && current && (
        <MediaCompare
          left={{
            src: toMediaUrl(current.route),
            name: splitRoute(current.route).fileName,
            status:
              current.pendingTagging === undefined
                ? 'new'
                : current.pendingTagging
                  ? 'pending'
                  : 'library'
          }}
          right={compared}
          onClose={() => setCompared(null)}
        />
      )}
    </div>
  )
}

/**
 * The same warning for media already in the app - mainly while working
 * through the pending queue, so it also lists other pending items (a batch
 * import can easily contain the same picture twice).
 */
export function EditedMediaSimilarWarning({
  media,
  onReplace,
  busy
}: {
  media: MediaModel
  onReplace?: (media: MediaModel) => void
  busy?: boolean
}): JSX.Element | null {
  const { t } = useTranslation()
  const { data } = useSimilarMedia(media.id, { includePending: true })
  return (
    <SimilarMediaWarning
      matches={data}
      title={t('addMedia.similarToExisting')}
      onReplace={onReplace}
      busy={busy}
      current={{
        route: media.route,
        name: media.name,
        type: media.type,
        pendingTagging: media.pendingTagging
      }}
    />
  )
}
