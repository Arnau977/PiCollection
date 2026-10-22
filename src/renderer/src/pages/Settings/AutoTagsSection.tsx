import { useTranslation } from 'react-i18next'
import { LoaderCircle, Wand2, X } from 'lucide-react'
import {
  AUTO_TAG_PROPERTIES,
  DANBOORU_DEFAULT_TAGS,
  DANBOORU_SIZES,
  ORIENTATION_TOLERANCE
} from '@shared/models'
import { SettingsRow } from '../../components/SettingsRow/SettingsRow'
import { Autocomplete } from '../../components/Autocomplete/Autocomplete'
import { useTags } from '../../hooks/useEntityLists'
import { useAutoTags } from '../../hooks/useAutoTags'

/** Numbers the property descriptions quote, so they can't drift from the rules. */
const DESCRIPTION_VALUES = {
  lowres: DANBOORU_SIZES.lowresMaxSide,
  highresWidth: DANBOORU_SIZES.highres.width,
  highresHeight: DANBOORU_SIZES.highres.height,
  absurdresWidth: DANBOORU_SIZES.absurdres.width,
  absurdresHeight: DANBOORU_SIZES.absurdres.height,
  incredible: DANBOORU_SIZES.incrediblyAbsurdresSide.toLocaleString('en-US'),
  extremeSide: DANBOORU_SIZES.extremeMinSide,
  extremeRatio: DANBOORU_SIZES.extremeRatio,
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
  const { status, error, saving, setRule, applyDanbooruDefaults } = useAutoTags({ poll: true })
  // Offered while a property with a Danbooru tag is still off.
  const danbooruFillable = AUTO_TAG_PROPERTIES.some(
    (property) =>
      DANBOORU_DEFAULT_TAGS[property] && !status?.rules.some((rule) => rule.property === property)
  )

  return (
    <section className="card">
      <h2>
        <Wand2 size={16} aria-hidden="true" />
        {t('autoTags.settingsTitle')}
      </h2>
      <p className="settings-version">{t('autoTags.settingsHint')}</p>
      {status !== null && danbooruFillable && (
        <SettingsRow
          title={t('autoTags.danbooruDefaults')}
          description={t('autoTags.danbooruDefaultsHint')}
        >
          <button
            type="button"
            className="btn"
            disabled={saving}
            aria-busy={saving}
            onClick={() => void applyDanbooruDefaults()}
          >
            {saving && <LoaderCircle size={14} className="auto-tags-spinner" aria-hidden="true" />}
            {t('autoTags.danbooruDefaultsButton')}
          </button>
        </SettingsRow>
      )}
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
