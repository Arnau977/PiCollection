import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { TagsManager } from './TagsManager'
import { CharactersManager } from './CharactersManager'
import { ArtistsManager } from './ArtistsManager'
import { SeriesManager } from './SeriesManager'
import { DiscardedManager } from './DiscardedManager'
import './ManagePage.css'

const MANAGE_TABS = ['artists', 'tags', 'characters', 'series', 'discarded'] as const
type ManageTab = (typeof MANAGE_TABS)[number]

function isManageTab(value: string | null): value is ManageTab {
  return (MANAGE_TABS as readonly (string | null)[]).includes(value)
}

export default function ManagePage(): JSX.Element {
  const { t } = useTranslation()
  // In the URL so Back (Alt+←, the mouse's back button) from a media count
  // returns to the tab it was clicked on. Switching tabs replaces the entry
  // instead of adding one, like Explorer's view changes.
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: ManageTab = isManageTab(requested) ? requested : 'artists'
  const setTab = (next: ManageTab): void => setParams({ tab: next }, { replace: true })

  return (
    <div className="page manage-page">
      <h1 className="page-title">{t('manage.title')}</h1>
      <div className="manage-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'artists'}
          className={tab === 'artists' ? 'manage-tab stats-tab-artists active' : 'manage-tab'}
          onClick={() => setTab('artists')}
        >
          {t('manage.artists')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tags'}
          className={tab === 'tags' ? 'manage-tab stats-tab-tags active' : 'manage-tab'}
          onClick={() => setTab('tags')}
        >
          {t('manage.tags')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'characters'}
          className={
            tab === 'characters' ? 'manage-tab stats-tab-characters active' : 'manage-tab'
          }
          onClick={() => setTab('characters')}
        >
          {t('manage.characters')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'series'}
          className={tab === 'series' ? 'manage-tab stats-tab-series active' : 'manage-tab'}
          onClick={() => setTab('series')}
        >
          {t('manage.series')}
        </button>
        {/* Not a metadata category, so it keeps the plain accent when active. */}
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'discarded'}
          className={tab === 'discarded' ? 'manage-tab active' : 'manage-tab'}
          onClick={() => setTab('discarded')}
        >
          {t('discarded.tab')}
        </button>
      </div>

      <div className="card manage-content">
        <div className="manage-tab-panel" hidden={tab !== 'artists'}>
          <ArtistsManager />
        </div>
        <div className="manage-tab-panel" hidden={tab !== 'tags'}>
          <TagsManager />
        </div>
        <div className="manage-tab-panel" hidden={tab !== 'characters'}>
          <CharactersManager />
        </div>
        <div className="manage-tab-panel" hidden={tab !== 'series'}>
          <SeriesManager />
        </div>
        {/* Mounted only while shown, so it reloads the list each time it's opened. */}
        {tab === 'discarded' && (
          <div className="manage-tab-panel">
            <DiscardedManager />
          </div>
        )}
      </div>
    </div>
  )
}
