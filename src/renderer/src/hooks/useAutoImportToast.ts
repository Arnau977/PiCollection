import { useCallback, useEffect, useState } from 'react'

/** How many pictures the last auto-import batch added, until the toast is dismissed. */
export function useAutoImportToast(): { count: number | null; dismiss: () => void } {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => window.api.autoImport.onAdded(setCount), [])

  const dismiss = useCallback(() => setCount(null), [])
  return { count, dismiss }
}
