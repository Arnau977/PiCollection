import { useState } from 'react'

const STORAGE_KEY = 'picollection.homeShowAutoTags'

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

/** Whether Home's "Top tags" includes automatic tags (absurdres, transparent...); remembered, on by default. */
export function useShowAutoTags(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(readStored)

  function update(next: boolean): void {
    setShow(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Private mode or blocked storage: the choice just isn't remembered.
    }
  }

  return [show, update]
}
