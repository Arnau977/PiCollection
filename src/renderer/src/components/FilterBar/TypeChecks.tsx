import { useTranslation } from 'react-i18next'
import type { MediaType } from '@shared/models'
import { MEDIA_TYPES, toggleType } from '@shared/query/mediaTypes'

interface TypeChecksProps {
  types: MediaType[] | undefined
  onChange: (types: MediaType[] | undefined) => void
  /** Id of the visible label naming the group. */
  labelledBy?: string
  /** Names the group when no visible label has an id to point at. */
  ariaLabel?: string
}

const LABEL_KEYS: Record<MediaType, string> = {
  image: 'filters.typeImage',
  gif: 'filters.typeGif',
  video: 'filters.typeVideo'
}

/** The type filter: one checkbox per type; none checked shows every type. */
export function TypeChecks({
  types,
  onChange,
  labelledBy,
  ariaLabel
}: TypeChecksProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="type-checks" role="group" aria-labelledby={labelledBy} aria-label={ariaLabel}>
      {MEDIA_TYPES.map((type) => (
        <label key={type} className="checkbox-row">
          <input
            type="checkbox"
            checked={types?.includes(type) ?? false}
            onChange={(e) => onChange(toggleType(types, type, e.target.checked))}
          />
          {t(LABEL_KEYS[type])}
        </label>
      ))}
    </div>
  )
}
