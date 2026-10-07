import { useTranslation } from 'react-i18next'

interface AliasesFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  hint: string
}

/**
 * One alias per line in a textarea that grows with its content: long titles
 * and several aliases stay readable, and Enter adds the next one.
 */
export function AliasesField({ id, value, onChange, hint }: AliasesFieldProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="field">
      <label htmlFor={id}>{t('manage.aliases')}</label>
      <textarea
        id={id}
        className="aliases-field"
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('manage.aliasesPlaceholder')}
        aria-describedby={`${id}-hint`}
      />
      <span id={`${id}-hint`} className="field-hint">
        {hint}
      </span>
    </div>
  )
}
