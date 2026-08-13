import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '@renderer/app.routes.const'
import type { StatsSummary } from '@shared/models'
import Gallery from '../../components/Gallery'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import { StatsBarList } from './StatsBarList'
import './HomePage.css'

const RECENT_LIMIT = 12
const EMPTY_STATS: StatsSummary = { topArtists: [], topTags: [], topCharacters: [], topSeries: [] }

type StatsTab = 'artists' | 'tags' | 'characters' | 'series'

function useStatsSummary(): { data: StatsSummary; loading: boolean } {
  const [state, setState] = useState<{ data: StatsSummary; loading: boolean }>({
    data: EMPTY_STATS,
    loading: true
  })

  useEffect(() => {
    let cancelled = false
    window.api.stats.getSummary().then((result) => {
      if (cancelled) return
      setState({ data: result.success ? result.data : EMPTY_STATS, loading: false })
    })
    return (): void => {
      cancelled = true
    }
  }, [])

  return state
}

export default function HomePage(): JSX.Element {
  const { t } = useTranslation()
  const { defaults } = useGalleryDefaults()
  const recentFilters = useMemo(() => ({ limit: RECENT_LIMIT }), [])
  const recentSorting = useMemo(() => ({ prop: 'createdAt' as const, desc: true }), [])
  const { data: recentMedia, loading: loadingRecent } = useMediaQuery(recentFilters, recentSorting)
  const { data: stats, loading: loadingStats } = useStatsSummary()
  const [statsTab, setStatsTab] = useState<StatsTab>('artists')

  return (
    <div className="page home-page">
      <h1 className="page-title">{t('home.title')}</h1>

      <section className="home-section">
        <div className="home-section-header">
          <h2>{t('home.recentAdditions')}</h2>
          <Link to={PATH.GALLERY} className="btn">
            {t('home.viewFullGallery')}
          </Link>
        </div>
        {loadingRecent ? (
          <p className="loading-state">{t('gallery.loading')}</p>
        ) : (
          <Gallery
            media={recentMedia}
            blurNsfw={defaults.blurNsfw}
            hideNames={defaults.hideNames}
          />
        )}
      </section>

      <section className="home-section">
        <h2>{t('home.stats')}</h2>
        {loadingStats ? (
          <p className="loading-state">{t('gallery.loading')}</p>
        ) : (
          <>
            <div className="manage-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={statsTab === 'artists'}
                className={statsTab === 'artists' ? 'manage-tab active' : 'manage-tab'}
                onClick={() => setStatsTab('artists')}
              >
                {t('home.topArtists')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statsTab === 'tags'}
                className={statsTab === 'tags' ? 'manage-tab active' : 'manage-tab'}
                onClick={() => setStatsTab('tags')}
              >
                {t('home.topTags')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statsTab === 'characters'}
                className={statsTab === 'characters' ? 'manage-tab active' : 'manage-tab'}
                onClick={() => setStatsTab('characters')}
              >
                {t('home.topCharacters')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statsTab === 'series'}
                className={statsTab === 'series' ? 'manage-tab active' : 'manage-tab'}
                onClick={() => setStatsTab('series')}
              >
                {t('home.topSeries')}
              </button>
            </div>
            <div className="card stats-panel">
              <div hidden={statsTab !== 'artists'}>
                <StatsBarList items={stats.topArtists} />
              </div>
              <div hidden={statsTab !== 'tags'}>
                <StatsBarList items={stats.topTags} />
              </div>
              <div hidden={statsTab !== 'characters'}>
                <StatsBarList items={stats.topCharacters} />
              </div>
              <div hidden={statsTab !== 'series'}>
                <StatsBarList items={stats.topSeries} />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
