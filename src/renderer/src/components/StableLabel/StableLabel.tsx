import './StableLabel.css'

interface StableLabelProps {
  /** The label shown right now. */
  current: string
  /** Every label this button can show (including `current`), so its width never changes between them. */
  labels: string[]
}

/**
 * Stacks all of a button's possible labels in one grid cell and only shows
 * the current one, so switching e.g. "Save" to "Saving..." doesn't resize
 * the button and nudge its neighbours in the action bar.
 */
export function StableLabel({ current, labels }: StableLabelProps): JSX.Element {
  return (
    <span className="stable-label">
      {Array.from(new Set([current, ...labels])).map((label) => (
        <span
          key={label}
          className={label === current ? undefined : 'stable-label-reserve'}
          aria-hidden={label === current ? undefined : true}
        >
          {label}
        </span>
      ))}
    </span>
  )
}
