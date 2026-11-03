import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyPlus, Replace } from 'lucide-react'
import type { MediaDuplicateMatch, MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { MediaCompare, type ComparedMedia } from '../../../components/MediaCompare/MediaCompare'
import { taxonomyOf, type ComparedTaxonomy } from '../../../components/MediaCompare/taxonomyDiff'
import { StableLabel } from '../../../components/StableLabel/StableLabel'
import { MediaHoverPreview } from '../../../components/MediaHoverPreview/MediaHoverPreview'
import { useSimilarMedia } from '../../../hooks/useSimilarMedia'
import { splitRoute } from '../../../utils/splitRoute'
import { hasCredits } from './copyCredits'

/** The file being added/edited, compared against each match. */
export interface CurrentFile {
  route: string
  name: string
  type: MediaModel['type']
  /** Unset while the file is being added (not saved yet). */
  pendingTagging?: boolean
  /** What the form has picked so far, saved or not. */
  taxonomy: ComparedTaxonomy
}

interface SimilarMediaWarningProps {
  matches: MediaDuplicateMatch[]
  title: string
  current?: CurrentFile
  /** "Replace with this file": the current file takes over that match. */
  onReplace?: (media: MediaModel) => void
  /** "Copy artist, characters & series" from that match into the form - a variant of the same drawing. */
  onCopyCredits?: (media: MediaModel) => void
  /** False once the form already has everything that match could add. */
  canCopyCredits?: (media: MediaModel) => boolean
  /** Locks the replace buttons while the form saves or replaces. */
  busy?: boolean
  /**
   * The matches are byte-identical copies, which block saving: the title is
   * an alert and each match reads "identical file" instead of a difference.
   */
  identical?: boolean
}

/**
 * "Looks similar to…" list, with a hover preview of each match. Non-blocking,
 * except for an identical copy, where replacing it is the way forward.
 */
export function SimilarMediaWarning({
  matches,
  title,
  current,
  onReplace,
  onCopyCredits,
  canCopyCredits = (): boolean => true,
  busy = false,
  identical = false
}: SimilarMediaWarningProps): JSX.Element | null {
  const { t } = useTranslation()
  const [compared, setCompared] = useState<ComparedMedia | null>(null)
  if (matches.length === 0) return null

  // A still frame can't be slid against a playing video, so videos keep just the hover preview.
  const canCompare = (media: MediaModel): boolean =>
    current !== undefined && current.type !== 'video' && media.type !== 'video'

  return (
    <div className="duplicate-warning">
      {identical ? (
        <p role="alert" className="duplicate-error">
          {title}
        </p>
      ) : (
        <p>{title}</p>
      )}
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
                        route: media.route,
                        name: splitRoute(media.route).fileName,
                        status: media.pendingTagging ? 'pending' : 'library',
                        taxonomy: taxonomyOf(media)
                      })
                  : undefined
              }
            >
              {splitRoute(media.route).fileName}
            </MediaHoverPreview>{' '}
            (
            {relation
              ? t(`media.relation.${relation}`)
              : identical
                ? t('addMedia.duplicateExactMatch')
                : t('addMedia.duplicateSimilarMatch', { distance })}
            {media.pendingTagging && ` · ${t('addMedia.similarPendingBadge')}`})
            {/* An identical copy can't be saved, so there's nothing to copy into. */}
            {onCopyCredits && !identical && hasCredits(media) && (
              <CopyCreditsButton
                name={splitRoute(media.route).fileName}
                done={!canCopyCredits(media)}
                busy={busy}
                onCopy={() => onCopyCredits(media)}
              />
            )}
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
            route: current.route,
            name: splitRoute(current.route).fileName,
            taxonomy: current.taxonomy,
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
 * Stays in place once everything is copied ("Already in the form",
 * aria-disabled so keyboard focus isn't lost) instead of disappearing.
 */
function CopyCreditsButton({
  name,
  done,
  busy,
  onCopy
}: {
  name: string
  done: boolean
  busy: boolean
  onCopy: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const labels = [t('addMedia.copyCredits'), t('addMedia.copyCreditsDone')]
  return (
    <button
      type="button"
      className="btn similar-match-copy"
      onClick={done ? undefined : onCopy}
      disabled={busy}
      aria-disabled={done || undefined}
      aria-label={done ? labels[1] : t('addMedia.copyCreditsLabel', { name })}
    >
      <CopyPlus size={14} aria-hidden="true" />
      <StableLabel current={done ? labels[1] : labels[0]} labels={labels} />
    </button>
  )
}

/**
 * The same warning for media already in the app - mainly while working
 * through the pending queue, so it also lists other pending items (a batch
 * import can easily contain the same picture twice).
 */
export function EditedMediaSimilarWarning({
  media,
  taxonomy,
  onReplace,
  onCopyCredits,
  canCopyCredits,
  busy
}: {
  media: MediaModel
  /** The form's current picks, which may not be saved yet. */
  taxonomy: ComparedTaxonomy
  onReplace?: (media: MediaModel) => void
  onCopyCredits?: (media: MediaModel) => void
  canCopyCredits?: (media: MediaModel) => boolean
  busy?: boolean
}): JSX.Element | null {
  const { t } = useTranslation()
  const { data } = useSimilarMedia(media.id, { includePending: true })
  return (
    <SimilarMediaWarning
      matches={data}
      title={t('addMedia.similarToExisting')}
      onReplace={onReplace}
      onCopyCredits={onCopyCredits}
      canCopyCredits={canCopyCredits}
      busy={busy}
      current={{
        route: media.route,
        name: media.name,
        type: media.type,
        pendingTagging: media.pendingTagging,
        taxonomy
      }}
    />
  )
}
