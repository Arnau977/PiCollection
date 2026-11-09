import { useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

const NARROW_QUERY = '(max-width: 900px)'

function subscribeNarrow(onChange: () => void): () => void {
  const list = window.matchMedia(NARROW_QUERY)
  list.addEventListener?.('change', onChange)
  return (): void => list.removeEventListener?.('change', onChange)
}

const isNarrow = (): boolean => window.matchMedia(NARROW_QUERY).matches

interface ManageFormPanelProps {
  title: string
  /** An item is being edited: the panel opens, so its fields are in view. */
  editing: boolean
  children: ReactNode
}

/**
 * The add/edit panel of a Metadata tab. Wide windows show it as a side
 * column, always open. Below 900px it sits above the list, and the open
 * form (up to five fields) left the list barely one row at the minimum
 * window, so there it starts folded to its heading, a button that opens it,
 * like the media form's suggestions rail. Editing an item opens it.
 */
export function ManageFormPanel({ title, editing, children }: ManageFormPanelProps): JSX.Element {
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow)
  const [open, setOpen] = useState(false)
  // Opening on edit is a state adjustment, so the user can still fold it.
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing !== wasEditing) {
    setWasEditing(editing)
    if (editing) setOpen(true)
  }
  const bodyId = useId()
  const expanded = !narrow || open

  return (
    <div className={`manage-form-panel${expanded ? '' : ' is-collapsed'}`}>
      <h2>
        {narrow ? (
          <button
            type="button"
            className="manage-form-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((prev) => !prev)}
          >
            <ChevronDown size={16} aria-hidden="true" />
            {title}
          </button>
        ) : (
          title
        )}
      </h2>
      <div id={bodyId} className="manage-form-body" hidden={!expanded}>
        {children}
      </div>
    </div>
  )
}
