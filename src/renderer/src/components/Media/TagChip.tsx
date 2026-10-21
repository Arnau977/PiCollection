import { useTranslation } from 'react-i18next'
import type { AutoTagProperty } from '@shared/models'

interface TagChipProps {
  name: string
  /** Set when the tag only comes from automatic rules: the properties that give it. */
  autoProperties?: AutoTagProperty[] | null
}

/** A tag chip; an automatic one is outlined and says which rule gives it. */
export function TagChip({ name, autoProperties }: TagChipProps): JSX.Element {
  const { t } = useTranslation()
  if (!autoProperties) return <li>{name}</li>
  const reasons = autoProperties.map((property) => t(`autoTags.property_${property}`)).join(', ')
  return (
    <li className="chip-auto" title={t('autoTags.chipTitle', { reasons })}>
      {name}
      <span className="visually-hidden">, {t('autoTags.chipAuto')}</span>
    </li>
  )
}
