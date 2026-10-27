import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Metadata's URL params: read from the URL once, then written from here only. */
export interface ManageParams {
  get: (key: string) => string
  set: (key: string, value: string) => void
}

/**
 * Metadata keeps its tab and each list's search/filter in the URL so Back -
 * the mouse's back button - from a media count (which opens the gallery)
 * finds the page as it was left. Going to the gallery unmounts the page and
 * Back mounts it again, so the URL is read on mount only; afterwards every
 * change is written from this one object, replacing the history entry
 * (typing and tab switches aren't navigation). Building each write from the
 * rendered location instead loses keystrokes: navigations land a render
 * later, so two quick writes both start from the same old URL.
 */
export function useManageParamsSource(): ManageParams {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useRef<URLSearchParams>()
  params.current ??= new URLSearchParams(location.search)
  const current = params.current
  return {
    get: (key) => current.get(key) ?? '',
    set: (key, value): void => {
      if ((current.get(key) ?? '') === value) return
      if (value) current.set(key, value)
      else current.delete(key)
      const search = current.toString()
      navigate({ pathname: location.pathname, search: search && `?${search}` }, { replace: true })
    }
  }
}

export const ManageParamsContext = createContext<ManageParams | null>(null)

/**
 * One value kept in Metadata's URL - the tab, or a list's search or filter
 * (`characters.search`, prefixed per tab since every tab stays mounted with
 * its own). Runs on local state and mirrors it to the URL through the
 * page's ManageParams.
 */
export function useManageParam(key: string): [string, (value: string) => void] {
  const ownSource = useManageParamsSource()
  const source = useContext(ManageParamsContext) ?? ownSource
  const [value, setValue] = useState(() => source.get(key))
  const sourceRef = useRef(source)
  sourceRef.current = source

  useEffect(() => sourceRef.current.set(key, value), [key, value])

  return [value, setValue]
}
