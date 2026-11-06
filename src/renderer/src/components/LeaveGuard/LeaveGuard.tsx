import { useEffect } from 'react'
import { useBlocker, type BlockerFunction } from 'react-router-dom'

/**
 * Only the user's own ways out count: a link, the sidebar, the mouse's back
 * button. The app's moves past a finished action (saved, sent to Pending, next
 * in a queue) always replace the history entry, so they pass.
 */
const isUserLeaving: BlockerFunction = ({ currentLocation, nextLocation, historyAction }) =>
  historyAction !== 'REPLACE' && currentLocation.pathname !== nextLocation.pathname

interface LeaveGuardProps {
  /** Asks the user, then calls `decide` with whether to go on leaving. */
  onAttempt: (decide: (leave: boolean) => void) => void
}

/** While mounted, holds any navigation away from the page until `onAttempt` decides. */
export function LeaveGuard({ onAttempt }: LeaveGuardProps): null {
  const blocker = useBlocker(isUserLeaving)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    onAttempt((leave) => (leave ? blocker.proceed() : blocker.reset()))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per attempt
  }, [blocker.state])

  return null
}
