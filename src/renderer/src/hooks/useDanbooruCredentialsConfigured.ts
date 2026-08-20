import { useEffect, useState } from 'react'

/**
 * Whether a Danbooru account is currently configured (see Settings). An
 * unidentified request is what got this app 403'd by Cloudflare in the
 * first place (see danbooruHttp.ts), so the main process now refuses these
 * calls entirely without credentials - the caller uses this to hide the
 * relevant UI instead of offering a button that can never work, same
 * pattern as useSauceNaoApiKey.
 */
export function useDanbooruCredentialsConfigured(): boolean {
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.danbooru.getCredentials().then((result) => {
      if (!cancelled && result.success) setConfigured(Boolean(result.data))
    })
    return (): void => {
      cancelled = true
    }
  }, [])

  return configured
}
