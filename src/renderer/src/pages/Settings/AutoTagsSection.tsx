import { useTranslation } from 'react-i18next'
import { Wand2, X } from 'lucide-react'
import {
  AUTO_TAG_PROPERTIES,
  HIGH_RES_MIN_SIDE,
  LOW_RES_MAX_SIDE,
  ORIENTATION_TOLERANCE
} from '@shared/models'
import { SettingsRow } from '../../components/SettingsRow/SettingsRow'
import { Autocomplete } from '../../components/Autocomplete/Autocomplete'
import { useTags } from '../../hooks/useEntityLists'
import { useAutoTags } from '../../hooks/useAutoTags'

/** Numbers the property descriptions quote, so they can't drift from the rules. */
const DESCRIPTION_VALUES = {
  high: HIGH_RES_MIN_SIDE,
  low: LOW_RES_MAX_SIDE,
  percent: Math.round((ORIENTATION_TOLERANCE - 1) * 100)
}

/**
 * One row per file property, each with the tag it gives (empty = off). The
 * tags are worked out when media is read, so a rule covers the whole library
 * at once and removing it leaves nothing behind.
 */
export function AutoTagsSection(): JSX.Element {
  const { t } = useTranslation()
  const { data: tags } = useTags()
  const { status, error, saving, setRule } = useAutoTags({ poll: true })

  return (
    <section className="card">
      <h2>
        <Wand2 size={16} aria-hidden="true" />
        {t('autoTags.settingsTitle')}
      </h2>
      <p className="settings-version">{t('autoTags.settingsHint')}</p>
      {AUTO_TAG_PROPERTIES.map((property) => {
        const label = t(`autoTags.property_${property}`)
        const tagId = status?.rules.find((rule) => rule.property === property)?.tagId ?? null
        return (
          <SettingsRow
            key={property}
            title={label}
            description={t(`autoTags.condition_${property}`, DESCRIPTION_VALUES)}
          >
            <div className="auto-tags-picker">
              <Autocomplete
                name={`auto-tag-${property}`}
                label={t('autoTags.tagFor', { property: label })}
                hideLabel
                options={tags}
                getOptionLabel={(tag) => tag.name}
                getOptionValue={(tag) => tag.id}
                selectedKey={tagId}
                onSelect={(tag) => {
                  if (tag && tag.id !== tagId) void setRule(property, tag.id)
                }}
                disabled={status === null || saving}
              />
              {tagId && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('autoTags.turnOff', { property: label })}
                  title={t('autoTags.turnOff', { property: label })}
                  disabled={saving}
                  onClick={() => void setRule(property, null)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </SettingsRow>
        )
      })}
      {status !== null && status.unanalyzed > 0 && (
        <p className="settings-version" role="status">
          {t('autoTags.analyzing', { count: status.unanalyzed })}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
