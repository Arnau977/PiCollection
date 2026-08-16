import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '@renderer/app.routes.const'
import type { StatsSummary } from '@shared/models'
import Gallery from '../../components/Gallery/Gallery'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import { itemCountForColumns } from '../../utils/fillRows'
import { StatsBarList } from './StatsBarList'
import './HomePage.css'

// Fetches a generous fixed batch up front - comfortably more than any
// reasonable window width could fill in 2 rows - so resizing the window
// only re-slices the already-fetched list instead of refetching.
const RECENT_FETCH_LIMIT = 40
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
  const recentFilters = useMemo(() => ({ limit: RECENT_FETCH_LIMIT }), [])
  const recentSorting = useMemo(() => ({ prop: 'createdAt' as const, desc: true }), [])
  const { data: recentMediaAll, loading: loadingRecent } = useMediaQuery(
    recentFilters,
    recentSorting
  )
  const { data: stats, loading: loadingStats } = useStatsSummary()
  const [statsTab, setStatsTab] = useState<StatsTab>('artists')

  const recentSectionRef = useRef<HTMLElement>(null)
  const [visibleCount, setVisibleCount] = useState<number | null>(null)

  // Sized to end on a fully-filled row (1 or 2) instead of a partial one.
  // Reads the column count the browser actually laid out for .gallery-grid
  // (repeat(auto-fill, ...)) rather than reimplementing its responsive
  // minmax/gap math here - a useLayoutEffect (not useEffect) so the
  // recalculated slice applies before paint, avoiding a flash of the full
  // fetched batch. A 0/unmeasurable column count (e.g. before first paint)
  // is left as "show everything fetched" rather than collapsing to empty.
  useLayoutEffect(() => {
    function measure(): void {
      const grid = recentSectionRef.current?.querySelector<HTMLElement>('.gallery-grid')
      if (!grid) return
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
      if (columns > 0) setVisibleCount(itemCountForColumns(columns))
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (recentSectionRef.current) observer.observe(recentSectionRef.current)
    return (): void => observer.disconnect()
  }, [recentMediaAll.length])

  const recentMedia = visibleCount === null ? recentMediaAll : recentMediaAll.slice(0, visibleCount)

  return (
    <div className="page home-page">
      <h1 className="page-title">{t('home.title')}</h1>

      <section className="home-section" ref={recentSectionRef}>
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
                className={
                  statsTab === 'artists'
                    ? 'manage-tab stats-tab-artists active'
                    : 'manage-tab stats-tab-artists'
                }
                onClick={() => setStatsTab('artists')}
              >
                {t('home.topArtists')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statsTab === 'tags'}
                className={
                  statsTab === 'tags'
                    ? 'manage-tab stats-tab-tags active'
                    : 'manage-tab stats-tab-tags'
                }
                onClick={() => setStatsTab('tags')}
              >
                {t('home.topTags')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statsTab === 'characters'}
                className={
                  statsTab === 'characters'
                    ? 'manage-tab stats-tab-characters active'
                    : 'manage-tab stats-tab-characters'
                }
                onClick={() => setStatsTab('characters')}
              >
                {t('home.topCharacters')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statsTab === 'series'}
                className={
                  statsTab === 'series'
                    ? 'manage-tab stats-tab-series active'
                    : 'manage-tab stats-tab-series'
                }
                onClick={() => setStatsTab('series')}
              >
                {t('home.topSeries')}
              </button>
            </div>
            <div className="card stats-panel">
              <div hidden={statsTab !== 'artists'}>
                <StatsBarList items={stats.topArtists} category="artists" />
              </div>
              <div hidden={statsTab !== 'tags'}>
                <StatsBarList items={stats.topTags} category="tags" />
              </div>
              <div hidden={statsTab !== 'characters'}>
                <StatsBarList items={stats.topCharacters} category="characters" />
              </div>
              <div hidden={statsTab !== 'series'}>
                <StatsBarList items={stats.topSeries} category="series" />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
