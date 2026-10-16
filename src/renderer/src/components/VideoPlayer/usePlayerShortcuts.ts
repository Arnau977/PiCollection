import { useEffect, useRef, type RefObject } from 'react'
import { isTypingTarget } from '../../hooks/useShortcut'
import { getInputModality, trackInputModality } from './inputModality'

export type PlayerAction =
  | 'togglePlay'
  | 'back'
  | 'forward'
  | 'frameBack'
  | 'frameForward'
  | 'loop'
  | 'mute'
  | 'fullscreen'
  | 'setA'
  | 'setB'
  | 'clearSection'

/** Shown in tooltips and aria-keyshortcuts, next to each control's name. */
export const PLAYER_SHORTCUT_LABELS: Record<PlayerAction, string> = {
  togglePlay: 'Space',
  back: 'ArrowLeft',
  forward: 'ArrowRight',
  frameBack: ',',
  frameForward: '.',
  loop: 'L',
  mute: 'M',
  fullscreen: 'F',
  setA: '[',
  setB: ']',
  clearSection: 'Shift+L'
}

function actionFor(e: KeyboardEvent): PlayerAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null // Alt+arrows: previous/next media
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if (key === 'l') return e.shiftKey ? 'clearSection' : 'loop'
  if (e.shiftKey) return null
  switch (key) {
    case ' ':
    case 'k':
      return 'togglePlay'
    case 'ArrowLeft':
      return 'back'
    case 'ArrowRight':
      return 'forward'
    case ',':
      return 'frameBack'
    case '.':
      return 'frameForward'
    case 'm':
      return 'mute'
    case 'f':
      return 'fullscreen'
    case '[':
      return 'setA'
    case ']':
      return 'setB'
    default:
      return null
  }
}

/**
 * The player in front: the one inside the topmost open modal (the Lightbox
 * over the detail page, the Make GIF dialog), or - with no modal open - the
 * one on the page itself.
 */
export function isFrontPlayer(el: HTMLElement): boolean {
  const modals = document.querySelectorAll('[aria-modal="true"]')
  if (modals.length === 0) return el.closest('[aria-modal="true"]') === null
  return modals[modals.length - 1].contains(el)
}

/**
 * Player keyboard shortcuts on the document, scoped to the player in front.
 * Not via useShortcut: that one stands down whenever any modal is open, and
 * two of the player's hosts are modals. Skipped while typing, and arrows
 * are left to a focused slider (the timeline/volume use them themselves).
 */
export function usePlayerShortcuts(
  containerRef: RefObject<HTMLElement>,
  actions: Partial<Record<PlayerAction, () => void>>
): void {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    trackInputModality()
    // Whether focus came into the player from the keyboard (Tab), not from a
    // mouse click that merely left a pill button focused.
    let keyboardFocus = false
    const onFocusIn = (): void => {
      keyboardFocus = getInputModality() === 'keyboard'
    }
    const onFocusOut = (e: FocusEvent): void => {
      if (!container.contains(e.relatedTarget as Node | null)) keyboardFocus = false
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (!container || e.repeat) return
      const action = actionFor(e)
      const run = action ? actionsRef.current[action] : undefined
      if (!action || !run || !isFrontPlayer(container)) return

      const active = document.activeElement as HTMLElement | null
      const nothingFocused =
        !active || active === document.body || active === document.documentElement
      const inPlayer = !nothingFocused && container.contains(active)
      // A control elsewhere on the page has focus (a button, a list, a field):
      // its keys are its own - Space must press it, letters may be typeahead.
      if (!nothingFocused && !inPlayer) return
      const onRange = active instanceof HTMLInputElement && active.type === 'range'
      if (inPlayer && isTypingTarget(active) && !onRange) return

      if (action === 'back' || action === 'forward') {
        // Plain arrows are the media page's previous/next: the player only
        // takes them with keyboard focus inside it, and a focused slider
        // (timeline, volume) moves its own value with them.
        if (!inPlayer || !keyboardFocus || onRange) return
      }
      // Space on a focused pill button presses that button natively.
      if (
        action === 'togglePlay' &&
        inPlayer &&
        !onRange &&
        active?.matches('button, a, [role="button"]')
      ) {
        return
      }
      // preventDefault tells the page's own listeners (e.g. MediaPage) the key
      // is taken; the capture phase makes sure this runs before them.
      e.preventDefault()
      run()
    }
    container.addEventListener('focusin', onFocusIn)
    container.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', handleKeyDown, true)
    return (): void => {
      container.removeEventListener('focusin', onFocusIn)
      container.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [containerRef])
}
