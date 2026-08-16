import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { MediaInput } from '@shared/models'
import { countSauceMissing, countWd14Missing } from './missingSuggestionCounts'
import { SauceNaoSuggestionsPanel } from './SauceNaoSuggestionsPanel'
import { Wd14SuggestionsPanel } from './Wd14SuggestionsPanel'
import type { MediaFormSuggestions } from './useMediaFormSuggestions'

interface SuggestionsRailProps {
  suggestions: MediaFormSuggestions
  input: MediaInput
  saving: boolean
  onApplyRating: (sfw: boolean) => void
}

/**
 * Below 900px the rail moves above the form fields (see the media query in
 * MediaForm.css) so it's reachable without scrolling past the whole form
 * first - but starting it expanded there would do the opposite, pushing the
 * actual fields down instead. Start collapsed only on that narrow layout;
 * wide screens keep the rail expanded as before.
 */
function defaultCollapsed(): boolean {
  return window.matchMedia('(max-width: 900px)').matches
}

export function SuggestionsRail({
  suggestions,
  input,
  saving,
  onApplyRating
}: SuggestionsRailProps): JSX.Element {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const totalMissing =
    countSauceMissing(suggestions.sauce.missing) + countWd14Missing(suggestions.wd14.missing)

  return (
    <aside className={`suggestions-rail${collapsed ? ' is-collapsed' : ''}`}>
      <button
        type="button"
        className="suggestions-rail-toggle"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        aria-label={t(collapsed ? 'addMedia.suggestionsExpand' : 'addMedia.suggestionsCollapse')}
      >
        {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        <span className="suggestions-rail-toggle-label">{t('addMedia.suggestionsTitle')}</span>
        {collapsed && totalMissing > 0 && (
          <span className="suggestions-rail-badge">{totalMissing}</span>
        )}
      </button>

      {!collapsed && (
        <div className="suggestions-rail-body">
          <div className="suggestions-rail-section">
            <span className="suggestions-rail-section-title">
              {t('addMedia.suggestionsSauceNaoTitle')}
            </span>
            <SauceNaoSuggestionsPanel
              hasApiKey={suggestions.hasSauceNaoApiKey}
              sauce={suggestions.sauce}
              inputRoute={input.route}
              inputType={input.type}
              saving={saving}
              onAddMissing={suggestions.addMissingSuggestion}
            />
          </div>

          <div className="suggestions-rail-section">
            <span className="suggestions-rail-section-title">
              {t('addMedia.suggestionsWd14Title')}
            </span>
            <Wd14SuggestionsPanel
              wd14Runtime={suggestions.wd14Runtime}
              wd14={suggestions.wd14}
              inputRoute={input.route}
              inputSfw={input.sfw}
              saving={saving}
              onAddMissing={suggestions.addWd14Suggestion}
              onApplyRating={onApplyRating}
            />
          </div>
        </div>
      )}
    </aside>
  )
}
