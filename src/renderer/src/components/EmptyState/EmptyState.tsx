import { Link } from 'react-router-dom'
import './EmptyState.css'

type EmptyStateAction = { label: string } & ({ onClick: () => void } | { to: string })

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  hint?: string
  action?: EmptyStateAction
}

export function EmptyState({ icon, title, hint, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-state-title">{title}</p>
      {hint && <p className="empty-state-hint">{hint}</p>}
      {action &&
        ('onClick' in action ? (
          <button type="button" className="btn btn-primary" onClick={action.onClick}>
            {action.label}
          </button>
        ) : (
          <Link to={action.to} className="btn btn-primary">
            {action.label}
          </Link>
        ))}
    </div>
  )
}
