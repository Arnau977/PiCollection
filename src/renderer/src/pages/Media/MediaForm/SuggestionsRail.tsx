import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { MediaInput } from '@shared/models'
import {
  countSauceMissing,
  countSourceSuggestions,
  countWd14Missing
} from './missingSuggestionCounts'
import { SauceNaoSuggestionsPanel } from './SauceNaoSuggestionsPanel'
import { SourceSuggestionsPanel } from './SourceSuggestionsPanel'
import { Wd14SuggestionsPanel } from './Wd14SuggestionsPanel'
import type { MediaFormSuggestions } from './useMediaFormSuggestions'
import { useSuggestionsTab, type SuggestionsTab } from './useSuggestionsTab'

interface SuggestionsRailProps {
  suggestions: MediaFormSuggestions
  input: MediaInput
  saving: boolean
  onApplyRating: (sfw: boolean) => void
  onApplySourceUrl: (url: string) => void
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

/**
 * One tab per suggestion source instead of stacking all three: with a
 * capture, SauceNAO and WD14 results together pushed everything far down
 * the rail. Each tab carries its count of pending suggestions, so results
 * in a tab that isn't shown aren't missed.
 */
export function SuggestionsRail({
  suggestions,
  input,
  saving,
  onApplyRating,
  onApplySourceUrl
}: SuggestionsRailProps): JSX.Element {
  const { t } = useTranslation()
  const idPrefix = useId()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [tab, setTab] = useSuggestionsTab(suggestions.source.available)
  const tabRefs = useRef(new Map<SuggestionsTab, HTMLButtonElement>())

  const tabs: { id: SuggestionsTab; label: string; count: number }[] = [
    ...(suggestions.source.available
      ? [
          {
            id: 'source' as const,
            label: suggestions.source.site ?? t('addMedia.suggestionsTabSource'),
            count: countSourceSuggestions(suggestions.source)
          }
        ]
      : []),
    {
      id: 'sauce',
      label: t('addMedia.suggestionsTabSauceNao'),
      count: countSauceMissing(suggestions.sauce.missing)
    },
    {
      id: 'wd14',
      label: t('addMedia.suggestionsTabWd14'),
      count: countWd14Missing(suggestions.wd14.missing)
    }
  ]
  const totalMissing = tabs.reduce((sum, { count }) => sum + count, 0)

  // WAI-ARIA tabs: arrows/Home/End move between tabs and select them.
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    const index = tabs.findIndex(({ id }) => id === tab)
    const next =
      e.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : e.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : null
    if (next === null) return
    e.preventDefault()
    setTab(tabs[next].id)
    tabRefs.current.get(tabs[next].id)?.focus()
  }

  const tabId = (id: SuggestionsTab): string => `${idPrefix}-tab-${id}`
  const panelId = (id: SuggestionsTab): string => `${idPrefix}-panel-${id}`
  const panelProps = (id: SuggestionsTab): React.HTMLAttributes<HTMLDivElement> => ({
    id: panelId(id),
    role: 'tabpanel',
    'aria-labelledby': tabId(id),
    hidden: tab !== id,
    className: 'suggestions-rail-panel'
  })

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
        <>
          <div
            className="suggestions-tabs"
            role="tablist"
            aria-label={t('addMedia.suggestionsTabsLabel')}
          >
            {tabs.map(({ id, label, count }) => (
              <button
                key={id}
                ref={(el) => {
                  if (el) tabRefs.current.set(id, el)
                  else tabRefs.current.delete(id)
                }}
                type="button"
                role="tab"
                id={tabId(id)}
                aria-selected={tab === id}
                aria-controls={panelId(id)}
                tabIndex={tab === id ? 0 : -1}
                className={`suggestions-tab${tab === id ? ' active' : ''}`}
                onClick={() => setTab(id)}
                onKeyDown={handleTabKeyDown}
              >
                <span className="suggestions-tab-label">{label}</span>
                {count > 0 && <span className="suggestions-rail-badge">{count}</span>}
              </button>
            ))}
          </div>

          <div className="suggestions-rail-body">
            {suggestions.source.available && (
              <div {...panelProps('source')}>
                <SourceSuggestionsPanel
                  source={suggestions.source}
                  onAdd={suggestions.addSourceSuggestion}
                  onAddExisting={suggestions.addSourceExisting}
                  onAddAllExisting={suggestions.addAllSourceExisting}
                  onApplyRating={onApplyRating}
                  onApplyAiGenerated={suggestions.applySourceAiGenerated}
                />
              </div>
            )}

            <div {...panelProps('sauce')}>
              <SauceNaoSuggestionsPanel
                hasApiKey={suggestions.hasSauceNaoApiKey}
                sauce={suggestions.sauce}
                inputRoute={input.route}
                inputType={input.type}
                inputSourceUrl={input.sourceUrl}
                saving={saving}
                onAddMissing={suggestions.addMissingSuggestion}
                onUseSourceUrl={onApplySourceUrl}
              />
            </div>

            <div {...panelProps('wd14')}>
              <Wd14SuggestionsPanel
                wd14Runtime={suggestions.wd14Runtime}
                wd14={suggestions.wd14}
                inputRoute={input.route}
                inputType={input.type}
                inputSfw={input.sfw}
                saving={saving}
                onAddMissing={suggestions.addWd14Suggestion}
                onApplyRating={onApplyRating}
              />
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
