import { useTranslation } from 'react-i18next'
import { CircleAlert } from 'lucide-react'
import type { MediaFormError, MediaFormField } from './mediaFormError'

const FIELD_LABEL_KEY: Record<MediaFormField, string> = {
  artist: 'filters.artist',
  tags: 'filters.tags',
  characters: 'filters.characters',
  series: 'manage.series'
}

/**
 * A failed save, shown right under the fixed top bar (where Save is) so it
 * never has to be scrolled to. A field error names the field and jumps to it;
 * the field itself gets a danger outline (`invalid` on its autocomplete).
 */
export function MediaFormSaveError({ error }: { error: MediaFormError }): JSX.Element {
  const { t } = useTranslation()
  const { field } = error

  function goToField(): void {
    const input = document.querySelector<HTMLInputElement>(
      `[data-form-field="${field}"] .react-aria-Input`
    )
    input?.scrollIntoView({ block: 'center' })
    input?.focus()
  }

  return (
    <div className="media-form-save-error" role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      <p>
        <strong>{t('addMedia.saveError.title')}</strong>{' '}
        {field ? t(`addMedia.saveError.missing.${field}`) : error.message}
      </p>
      {field && (
        <button type="button" className="btn" onClick={goToField}>
          {t('addMedia.saveError.goTo', { field: t(FIELD_LABEL_KEY[field]) })}
        </button>
      )}
    </div>
  )
}
