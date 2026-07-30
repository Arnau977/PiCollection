import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '@renderer/app.routes.const'
import type { EntityCount, StatsSummary } from '@shared/models'
import Gallery from '../../components/Gallery'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import './HomePage.css'

const RECENT_LIMIT = 12
const EMPTY_STATS: StatsSummary = { topArtists: [], topTags: [], topCharacters: [], topSeries: [] }

interface StatsPanelProps {
  title: string
  items: EntityCount[]
}

function StatsPanel({ title, items }: StatsPanelProps): JSX.Element {
  const { t } = useTranslation()
  const max = Math.max(1, ...items.map((item) => item.count))

  return (
    <div className="card stats-panel">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="stats-empty">{t('home.noData')}</p>
      ) : (
        <ul className="stats-bar-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="stats-bar-label">{item.name}</span>
              <div className="stats-bar-track">
                <div className="stats-bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
              <span className="stats-bar-count">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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

  return (
    <div className="page home-page">
      <h1>{t('home.title')}</h1>

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
          <div className="home-stats-grid">
            <StatsPanel title={t('home.topArtists')} items={stats.topArtists} />
            <StatsPanel title={t('home.topTags')} items={stats.topTags} />
            <StatsPanel title={t('home.topCharacters')} items={stats.topCharacters} />
            <StatsPanel title={t('home.topSeries')} items={stats.topSeries} />
          </div>
        )}
      </section>
    </div>
  )
}
