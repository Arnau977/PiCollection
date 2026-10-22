import { useCallback, useEffect, useState } from 'react'
import type { AutoTagProperty, AutoTagStatus } from '@shared/models'

/** How often Settings re-reads progress while the library is being analyzed. */
const POLL_MS = 2000

interface UseAutoTagsResult {
  status: AutoTagStatus | null
  error: string | null
  saving: boolean
  setRule: (property: AutoTagProperty, tagId: string | null) => Promise<void>
  /** Gives every rule still off its Danbooru tag (main: applyDanbooruDefaults). */
  applyDanbooruDefaults: () => Promise<void>
}

/**
 * The automatic-tag rules and how many pictures still wait to be analyzed.
 * With `poll`, re-reads the count while it's above zero (Settings' progress
 * line); everywhere else one read is enough, and only once `enabled` (a
 * chip that needs explaining).
 */
export function useAutoTags({ poll = false, enabled = true } = {}): UseAutoTagsResult {
  const [status, setStatus] = useState<AutoTagStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    const result = await window.api.autoTags.getStatus()
    if (result.success) setStatus(result.data)
    else setError(result.error.message)
  }, [])

  useEffect(() => {
    if (enabled) void load()
  }, [enabled, load])

  const unanalyzed = status?.unanalyzed ?? 0
  useEffect(() => {
    if (!poll || unanalyzed === 0) return
    const timer = setTimeout(() => void load(), POLL_MS)
    return (): void => clearTimeout(timer)
  }, [poll, unanalyzed, status, load])

  const setRule = useCallback(
    async (property: AutoTagProperty, tagId: string | null): Promise<void> => {
      setSaving(true)
      const result = await window.api.autoTags.setRule({ property, tagId })
      if (result.success) {
        setError(null)
        await load()
      } else {
        setError(result.error.message)
      }
      setSaving(false)
    },
    [load]
  )

  const applyDanbooruDefaults = useCallback(async (): Promise<void> => {
    setSaving(true)
    const result = await window.api.autoTags.applyDanbooruDefaults()
    if (result.success) {
      setError(null)
      await load()
    } else {
      setError(result.error.message)
    }
    setSaving(false)
  }, [load])

  return { status, error, saving, setRule, applyDanbooruDefaults }
}

/** The properties whose rule gives `tagId`, for an automatic chip's tooltip. */
export function autoTagProperties(status: AutoTagStatus | null, tagId: string): AutoTagProperty[] {
  return (status?.rules ?? []).filter((rule) => rule.tagId === tagId).map((rule) => rule.property)
}
