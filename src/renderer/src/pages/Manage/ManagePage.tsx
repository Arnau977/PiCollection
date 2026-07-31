import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TagsManager } from './TagsManager'
import { CharactersManager } from './CharactersManager'
import { ArtistsManager } from './ArtistsManager'
import { SeriesManager } from './SeriesManager'
import './ManagePage.css'

type ManageTab = 'artists' | 'tags' | 'characters' | 'series'

export default function ManagePage(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ManageTab>('artists')

  return (
    <div className="page manage-page">
      <h1 className="gradient-title">{t('manage.title')}</h1>
      <div className="manage-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'artists'}
          className={tab === 'artists' ? 'manage-tab active' : 'manage-tab'}
          onClick={() => setTab('artists')}
        >
          {t('manage.artists')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tags'}
          className={tab === 'tags' ? 'manage-tab active' : 'manage-tab'}
          onClick={() => setTab('tags')}
        >
          {t('manage.tags')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'characters'}
          className={tab === 'characters' ? 'manage-tab active' : 'manage-tab'}
          onClick={() => setTab('characters')}
        >
          {t('manage.characters')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'series'}
          className={tab === 'series' ? 'manage-tab active' : 'manage-tab'}
          onClick={() => setTab('series')}
        >
          {t('manage.series')}
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
      </div>
    </div>
  )
}
