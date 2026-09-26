import type { ReactNode } from 'react'
import './SettingsRow.css'

interface SettingsRowProps {
  icon?: ReactNode
  title: string
  description?: string
  children?: ReactNode
  /** 'h2' when this row is the only one in its card (BackupSection,
   * ExtensionBridgeSection, ...) - it's standing in for the card's old <h2>
   * header, so it needs to stay a real heading for screen-reader/heading-nav
   * users. Left as 'span' (default) for a field row inside a card that
   * already has its own <h2> (Filters), or one of several settings grouped
   * under a single card with no shared heading of its own (General). */
  titleAs?: 'span' | 'h2'
}

/** Windows 11 "SettingsCard" row: icon/title/description on the left, one
 * control (toggle, select, button group) right-aligned on the same line -
 * stacks full-width instead of a boxy per-setting card, so a lone checkbox
 * doesn't cost as much vertical space as a multi-field form. Group several
 * under one `.card` (SettingsRow adds its own divider above all but the
 * first) rather than wrapping each in its own card. */
export function SettingsRow({
  icon,
  title,
  description,
  children,
  titleAs: TitleTag = 'span'
}: SettingsRowProps): JSX.Element {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <TitleTag className="settings-row-title">
          {icon}
          {title}
        </TitleTag>
        {description && <span className="settings-row-description">{description}</span>}
      </div>
      {children && <div className="settings-row-control">{children}</div>}
    </div>
  )
}
