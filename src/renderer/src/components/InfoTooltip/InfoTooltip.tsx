import { HelpCircle } from 'lucide-react'
import './InfoTooltip.css'

interface InfoTooltipProps {
  text: string
}

export function InfoTooltip({ text }: InfoTooltipProps): JSX.Element {
  return (
    <span className="info-tooltip" tabIndex={0} aria-label={text}>
      <HelpCircle size={14} aria-hidden="true" />
      <span className="info-tooltip-bubble" aria-hidden="true">
        {text}
      </span>
    </span>
  )
}
