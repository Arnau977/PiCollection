import { createContext, useContext, useState, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router-dom'

const Children = createContext<ReactNode>(null)

function CurrentChildren(): JSX.Element {
  return <>{useContext(Children)}</>
}

/** A data router for tests, like the app's: `useBlocker` needs one. */
export function TestRouter({
  children,
  initialEntries
}: {
  children: ReactNode
  initialEntries?: InitialEntry[]
}): JSX.Element {
  const [router] = useState(() =>
    createMemoryRouter([{ path: '*', element: <CurrentChildren /> }], { initialEntries })
  )
  return (
    <Children.Provider value={children}>
      <RouterProvider router={router} />
    </Children.Provider>
  )
}
