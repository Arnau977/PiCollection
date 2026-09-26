import { useTranslation } from 'react-i18next'
import type { MediaDuplicateMatch } from '@shared/models'
import { MediaHoverPreview } from '../../../components/MediaHoverPreview/MediaHoverPreview'
import { useSimilarMedia } from '../../../hooks/useSimilarMedia'

interface SimilarMediaWarningProps {
  matches: MediaDuplicateMatch[]
  title: string
}

/** Non-blocking "looks similar to…" list, with a hover preview of each match. */
export function SimilarMediaWarning({
  matches,
  title
}: SimilarMediaWarningProps): JSX.Element | null {
  const { t } = useTranslation()
  if (matches.length === 0) return null

  return (
    <div className="duplicate-warning">
      <p>{title}</p>
      <ul className="chip-list">
        {matches.map(({ media, distance }) => (
          <li key={media.id}>
            <MediaHoverPreview media={media}>{media.name}</MediaHoverPreview> (
            {t('addMedia.duplicateSimilarMatch', { distance })}
            {media.pendingTagging && ` · ${t('addMedia.similarPendingBadge')}`})
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The same warning for media already in the app - mainly while working
 * through the pending queue, so it also lists other pending items (a batch
 * import can easily contain the same picture twice).
 */
export function EditedMediaSimilarWarning({ mediaId }: { mediaId: string }): JSX.Element | null {
  const { t } = useTranslation()
  const { data } = useSimilarMedia(mediaId, { includePending: true })
  return <SimilarMediaWarning matches={data} title={t('addMedia.similarToExisting')} />
}
