import { useEffect, useState } from 'react'

/** The configured source folder (Settings), or null while loading / when none is set. */
export function useSourceFolder(): string | null {
  const [folder, setFolder] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.sourceFolder.get().then((result) => {
      if (!cancelled && result.success) setFolder(result.data)
    })
    return (): void => {
      cancelled = true
    }
  }, [])

  return folder
}
