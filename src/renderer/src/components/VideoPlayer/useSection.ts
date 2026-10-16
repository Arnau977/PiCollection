import { useCallback, useState } from 'react'
import type { Section } from './VideoPlayer'

/** Shorter than this, a section can't loop meaningfully (and is likely a misclick). */
export const MIN_SECTION_SECONDS = 0.1

export interface UseSection {
  /** The looped range, once both ends are set. */
  section: Section | null
  /** A, set on its own, waiting for B. */
  pendingStart: number | null
  setA: (time: number) => void
  setB: (time: number) => void
  /** Replaces the whole range (dragging a marker), normalized the same way. */
  setSection: (section: Section) => void
  clear: () => void
}

/**
 * Normalizes a pair of times into a section: swapped if reversed, clamped to
 * the video, and null when too short to loop.
 */
export function normalizeSection(a: number, b: number, duration: number | null): Section | null {
  const max = duration ?? Number.POSITIVE_INFINITY
  const clamp = (t: number): number => Math.min(Math.max(t, 0), max)
  const start = clamp(Math.min(a, b))
  const end = clamp(Math.max(a, b))
  return end - start >= MIN_SECTION_SECONDS ? { start, end } : null
}

/** The A↔B section of one video: per video and session, never saved. */
export function useSection(duration: number | null): UseSection {
  const [section, setSectionState] = useState<Section | null>(null)
  const [pendingStart, setPendingStart] = useState<number | null>(null)

  const setA = useCallback(
    (time: number) => {
      if (section) {
        // An edit that would leave it too short keeps the current section.
        const next = normalizeSection(time, section.end, duration)
        if (next) setSectionState(next)
      } else {
        setPendingStart(Math.min(Math.max(time, 0), duration ?? Number.POSITIVE_INFINITY))
      }
    },
    [section, duration]
  )

  const setB = useCallback(
    (time: number) => {
      const start = section?.start ?? pendingStart ?? 0
      const next = normalizeSection(start, time, duration)
      // Too short (B on top of A): keep waiting for a real end.
      if (!next) return
      setSectionState(next)
      setPendingStart(null)
    },
    [section, pendingStart, duration]
  )

  const setSection = useCallback(
    (next: Section) => {
      // A marker dragged onto the other one stops there instead of deleting it.
      const normalized = normalizeSection(next.start, next.end, duration)
      if (normalized) setSectionState(normalized)
    },
    [duration]
  )

  const clear = useCallback(() => {
    setSectionState(null)
    setPendingStart(null)
  }, [])

  return { section, pendingStart, setA, setB, setSection, clear }
}
