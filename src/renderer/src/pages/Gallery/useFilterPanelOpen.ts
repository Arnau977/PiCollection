import { useState } from 'react'

export const FILTER_PANEL_ID = 'gallery-filter-panel'
const OPEN_KEY = 'picollection.gallery.filterPanelOpen'

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== 'false'
  } catch {
    return true
  }
}

/** Whether the filter panel is shown, remembered across sessions (open by default). */
export function useFilterPanelOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(readOpen)

  function toggle(): void {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, String(next))
    } catch {
      // Not remembered this time; the panel still toggles.
    }
  }

  return [open, toggle]
}
