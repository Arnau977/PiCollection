import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen } from 'lucide-react'
import { useSourceFolder } from '../../hooks/useSourceFolder'
import { fetchFileSize, fileFormat, formatFileSize } from '../../utils/fileSize'
import { relativeFolder } from '../../utils/relativeFolder'
import { splitRoute } from '../../utils/splitRoute'

interface MediaFileInfoProps {
  route: string
  src: string
  type: 'image' | 'video' | 'gif'
}

interface Dimensions {
  width: number
  height: number
}

/** Read from the file itself in the renderer: no stored value covers videos. */
function useDimensions(src: string, type: MediaFileInfoProps['type']): Dimensions | null {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null)
  useEffect(() => {
    setDimensions(null)
    if (type === 'video') {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = (): void =>
        setDimensions({ width: video.videoWidth, height: video.videoHeight })
      video.src = src
      return (): void => {
        video.onloadedmetadata = null
        video.removeAttribute('src')
        video.load()
      }
    }
    const image = new Image()
    image.onload = (): void =>
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight })
    image.src = src
    return (): void => {
      image.onload = null
    }
  }, [src, type])
  return dimensions
}

function useFileSize(src: string): number | null {
  const [bytes, setBytes] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    setBytes(null)
    void fetchFileSize(src).then((size) => {
      if (!cancelled) setBytes(size)
    })
    return (): void => {
      cancelled = true
    }
  }, [src])
  return bytes
}

/**
 * Where the file lives (relative to the source folder, the full path on
 * hover) and its format, resolution and weight - what used to need the
 * edit form. Same pieces, in the same order, as the compare view's labels.
 */
export function MediaFileInfo({ route, src, type }: MediaFileInfoProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const sourceFolder = useSourceFolder()
  const dimensions = useDimensions(src, type)
  const bytes = useFileSize(src)
  const { fileName } = splitRoute(route)
  const folder = relativeFolder(route, sourceFolder)
  // Shown the way Explorer writes paths, whichever separator was stored.
  const relativePath = (folder ? `${folder}\\${fileName}` : fileName).replace(/\//g, '\\')
  const isAbsolute = /^([a-z]:|[\\/]{2})/i.test(route)
  const fullPath = (
    isAbsolute || !sourceFolder ? route : `${sourceFolder.replace(/[\\/]+$/, '')}\\${route}`
  ).replace(/\//g, '\\')
  const details = [
    fileFormat(src),
    dimensions && t('mediaCompare.dimensions', { ...dimensions }),
    bytes !== null && formatFileSize(bytes, i18n.language)
  ].filter(Boolean)

  return (
    <div className="media-detail-file" title={fullPath}>
      <span className="media-detail-file-path">
        <FolderOpen size={14} aria-hidden="true" />
        <span>{relativePath}</span>
      </span>
      {details.length > 0 && <span className="media-detail-file-meta">{details.join(' · ')}</span>}
    </div>
  )
}
