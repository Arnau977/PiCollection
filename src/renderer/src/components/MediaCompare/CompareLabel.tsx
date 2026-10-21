import { useTranslation } from 'react-i18next'
import { splitRoute } from '../../utils/splitRoute'
import { relativeFolder } from '../../utils/relativeFolder'
import type { Dimensions } from './dividerBounds'
import { fileFormat, formatFileSize } from './fileSize'
import type { ComparedMedia } from './MediaCompare'

interface CompareLabelProps {
  media: ComparedMedia
  size?: Dimensions
  bytes?: number
  sourceFolder: string | null
}

/**
 * One side's header: file name, then where it lives (relative to the source
 * folder - two copies often differ only there), then status, format,
 * resolution and weight. The full path is on hover.
 */
export function CompareLabel({ media, size, bytes, sourceFolder }: CompareLabelProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const { fileName } = splitRoute(media.route)
  const folder = relativeFolder(media.route, sourceFolder)
  const details = [
    fileFormat(media.src),
    size && t('mediaCompare.dimensions', size),
    bytes !== undefined && formatFileSize(bytes, i18n.language)
  ].filter(Boolean)
  return (
    <span className="media-compare-label" title={media.route}>
      <span className="media-compare-label-name">{fileName}</span>
      <span className="media-compare-label-folder">{folder || t('mediaCompare.sourceRoot')}</span>
      <span className="media-compare-label-meta">
        {media.status && (
          <span className="media-compare-status">{t(`mediaCompare.status.${media.status}`)}</span>
        )}
        {details.length > 0 && (
          <span className="media-compare-label-size">{details.join(' · ')}</span>
        )}
      </span>
    </span>
  )
}
