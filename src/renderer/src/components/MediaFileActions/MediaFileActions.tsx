import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, FolderOpen, ImageDown, LoaderCircle } from 'lucide-react'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { copyImageViaCanvas } from './copyImageViaCanvas'
import './MediaFileActions.css'

interface MediaFileActionsProps {
  route: string
  type?: MediaModel['type']
}

/** Icon-only clipboard/folder actions for a media file, shared by the detail view and the lightbox. */
export function MediaFileActions({ route, type }: MediaFileActionsProps): JSX.Element {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [mediaCopied, setMediaCopied] = useState(false)
  // A GIF/animated WebP is copied as a file through PowerShell (~1 s).
  const [copyingMedia, setCopyingMedia] = useState(false)

  async function handleCopyLocation(): Promise<void> {
    // Goes through the main process so a route stored relative to the source
    // folder lands on the clipboard as a usable absolute path.
    const result = await window.api.system.copyLocationToClipboard(route)
    if (!result.success) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyMedia(): Promise<void> {
    setCopyingMedia(true)
    const result = await window.api.system.copyImageToClipboard(route)
    const copied = result.success || (await copyImageViaCanvas(toMediaUrl(route)))
    setCopyingMedia(false)
    if (!copied) return
    setMediaCopied(true)
    setTimeout(() => setMediaCopied(false), 2000)
  }

  function handleOpenInFolder(): void {
    window.api.system.showInFolder(route)
  }

  const copyLabel = copied ? t('media.locationCopied') : t('media.copyLocation')
  const copyMediaLabel = copyingMedia
    ? t('media.copyingMedia')
    : mediaCopied
      ? t('media.mediaCopied')
      : t('media.copyMedia')

  return (
    <div className="media-file-actions">
      {/* Video clipboard formats aren't supported across OSes, so only offer this for stills. */}
      {type !== 'video' && (
        <button
          type="button"
          className="icon-btn"
          aria-label={copyMediaLabel}
          title={copyMediaLabel}
          onClick={handleCopyMedia}
          disabled={copyingMedia}
          aria-busy={copyingMedia}
        >
          {copyingMedia ? (
            <LoaderCircle size={16} className="media-file-actions-spinner" />
          ) : mediaCopied ? (
            <Check size={16} />
          ) : (
            <ImageDown size={16} />
          )}
        </button>
      )}
      <button
        type="button"
        className="icon-btn"
        aria-label={copyLabel}
        title={copyLabel}
        onClick={handleCopyLocation}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={t('media.openInFolder')}
        title={t('media.openInFolder')}
        onClick={handleOpenInFolder}
      >
        <FolderOpen size={16} />
      </button>
    </div>
  )
}
