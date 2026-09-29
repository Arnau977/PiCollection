import { useEffect, useState } from 'react'
import type { AiMetadataDetection, MediaInput } from '@shared/models'

/**
 * Reads the file's own metadata for generator traces (a local read, nothing
 * leaves the machine). Images and GIFs only - video containers aren't
 * searched. Null while loading, for other types, or when nothing was found.
 */
export function useAiMetadataDetection(
  route: string | undefined,
  type: MediaInput['type']
): AiMetadataDetection | null {
  const [detection, setDetection] = useState<AiMetadataDetection | null>(null)

  useEffect(() => {
    setDetection(null)
    if (!route || type === 'video') return
    let cancelled = false
    void window.api.media.detectAiMetadata(route).then((result) => {
      if (!cancelled && result.success) setDetection(result.data)
    })
    return (): void => {
      cancelled = true
    }
  }, [route, type])

  return detection
}
