export type InputModality = 'keyboard' | 'pointer'

let modality: InputModality = 'pointer'
let installed = false

/**
 * Whether the user's last interaction was the keyboard or a pointer, so the
 * player can tell keyboard focus (keep the pill up, take the arrows) from
 * the focus a mouse click leaves on a button (neither). Installed once,
 * in the capture phase so it runs before anything else sees the event.
 */
export function trackInputModality(): void {
  if (installed) return
  installed = true
  document.addEventListener(
    'keydown',
    (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) modality = 'keyboard'
    },
    true
  )
  document.addEventListener('pointerdown', () => (modality = 'pointer'), true)
}

export function getInputModality(): InputModality {
  return modality
}
