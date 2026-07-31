import { useEffect, useState } from 'react'

/**
 * Whether a SauceNAO API key is currently configured. SauceNAO no longer
 * allows anonymous API access at all (see sauceNao.service.ts), so any
 * suggestion attempt without a key is guaranteed to fail - the caller uses
 * this to hide the suggestions UI entirely instead of offering a button
 * that can never work.
 */
export function useSauceNaoApiKey(): boolean {
  const [hasApiKey, setHasApiKey] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.sauceNao.getApiKey().then((result) => {
      if (!cancelled && result.success) setHasApiKey(Boolean(result.data))
    })
    return (): void => {
      cancelled = true
    }
  }, [])

  return hasApiKey
}
