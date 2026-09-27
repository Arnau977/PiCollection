import { useTranslation } from 'react-i18next'

/**
 * Muted "form of Pyra" line inside a character chip, for a suggested
 * form/costume that will be created as a child of that base character.
 */
export function CharacterFormOfHint({ parent }: { parent?: string }): JSX.Element | null {
  const { t } = useTranslation()
  if (!parent) return null
  return <span className="suggestion-form-of">{t('suggestions.formOf', { parent })}</span>
}
