import { useEffect, useRef } from 'react'

export interface Shortcut {
  /** `KeyboardEvent.key`, case-insensitive: 's', 'b', 'ArrowLeft'... */
  key: string
  /** Ctrl on Windows/Linux, Cmd on macOS. */
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

export const SHORTCUTS = {
  save: { key: 's', ctrl: true },
  edit: { key: 'e' },
  suggestLocally: { key: 'a', ctrl: true, shift: true },
  previous: { key: 'ArrowLeft', alt: true },
  next: { key: 'ArrowRight', alt: true },
  toggleBlur: { key: 'b', ctrl: true },
  saveAndResolve: { key: 's', ctrl: true, shift: true },
  leaveEdit: { key: 'Escape' }
} satisfies Record<string, Shortcut>

const TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

const KEY_LABELS: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc' }

function matches(e: KeyboardEvent, shortcut: Shortcut): boolean {
  return (
    e.key.toLowerCase() === shortcut.key.toLowerCase() &&
    Boolean(shortcut.ctrl) === (e.ctrlKey || e.metaKey) &&
    Boolean(shortcut.shift) === e.shiftKey &&
    Boolean(shortcut.alt) === e.altKey
  )
}

/** "Ctrl+Shift+A" - for tooltips. */
export function formatShortcut(shortcut: Shortcut): string {
  const key = KEY_LABELS[shortcut.key] ?? shortcut.key.toUpperCase()
  return [shortcut.ctrl && 'Ctrl', shortcut.shift && 'Shift', shortcut.alt && 'Alt', key]
    .filter(Boolean)
    .join('+')
}

/** The `aria-keyshortcuts` value ("Control+Shift+A"). */
export function ariaShortcut(shortcut: Shortcut): string {
  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key
  return [shortcut.ctrl && 'Control', shortcut.shift && 'Shift', shortcut.alt && 'Alt', key]
    .filter(Boolean)
    .join('+')
}

/**
 * Runs `handler` on `shortcut` anywhere in the window. A plain-key shortcut
 * (no Ctrl/Alt) is ignored while typing in a field - except that a plain
 * Escape there leaves the field, so a second Escape reaches the shortcut
 * (typing a tag and pressing Esc twice exits) - and every shortcut is
 * ignored while a modal dialog (confirm, lightbox, compare) is open - those
 * own the keyboard.
 */
export function useShortcut(shortcut: Shortcut, handler: () => void, enabled = true): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const { key, ctrl, shift, alt } = shortcut

  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.repeat || !matches(e, { key, ctrl, shift, alt })) return
      const target = e.target as HTMLElement | null
      const typing = target && (TEXT_INPUT_TAGS.has(target.tagName) || target.isContentEditable)
      if (typing && !ctrl && !alt) {
        if (e.key === 'Escape') target.blur()
        return
      }
      if (document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      handlerRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return (): void => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, key, ctrl, shift, alt])
}
