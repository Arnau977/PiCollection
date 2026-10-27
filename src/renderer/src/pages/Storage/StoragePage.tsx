import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, FolderOpen } from 'lucide-react'
import type { StorageEntity, StorageFolder } from '@shared/models'
import { PATH } from '../../app.routes.const'
import {
  openEntityInGallery,
  type CountEntityKind
} from '../../components/EntityCountButton/EntityCountButton'
import { useStorageOverview } from '../../hooks/useStorageOverview'
import { formatFileSize } from '../../utils/fileSize'
import { useManageParamsSource } from '../Manage/useManageParam'
import { StorageBarList, type StorageBarItem } from './StorageBarList'
import '../Manage/ManagePage.css'
import './StoragePage.css'

type StorageTab = 'folders' | 'series' | 'characters' | 'artists'

const TABS: { tab: StorageTab; className: string; labelKey: string; color: string }[] = [
  { tab: 'folders', className: '', labelKey: 'storage.tabFolders', color: 'var(--accent-fg)' },
  {
    tab: 'series',
    className: 'stats-tab-series',
    labelKey: 'manage.series',
    color: 'var(--color-series)'
  },
  {
    tab: 'characters',
    className: 'stats-tab-characters',
    labelKey: 'filters.characters',
    color: 'var(--color-character)'
  },
  {
    tab: 'artists',
    className: 'stats-tab-artists',
    labelKey: 'storage.tabArtists',
    color: 'var(--color-artist)'
  }
]

const ENTITY_KIND: Record<Exclude<StorageTab, 'folders'>, CountEntityKind> = {
  series: 'series',
  characters: 'character',
  artists: 'artist'
}

const ABSOLUTE = /^([a-z]:|[\\/])/i

/** The folder a folder sits in on this page: '' for the top level and for ones outside the source folder. */
function parentFolder(path: string): string | null {
  if (path === '') return null
  if (ABSOLUTE.test(path)) return ''
  const cut = path.lastIndexOf('\\')
  return cut === -1 ? '' : path.slice(0, cut)
}

/**
 * Disk space at a glance: what the library weighs, what Pending and files
 * deleted but still on disk add, and where the weight is - by folder (shares
 * add up to the library) and by series, character and artist (a picture
 * counts in each it has, so those don't).
 */
export default function StoragePage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { data, loading, error } = useStorageOverview()
  // In the URL like Metadata's (one params source for both), so Back from a
  // file's page or the gallery returns to the same tab and folder.
  const params = useManageParamsSource()
  const [tab, setTabState] = useState<StorageTab>(() => {
    const saved = params.get('tab')
    return TABS.some((entry) => entry.tab === saved) ? (saved as StorageTab) : 'folders'
  })
  const [folder, setFolderState] = useState(() => params.get('folder'))
  function setTab(next: StorageTab): void {
    setTabState(next)
    params.set('tab', next)
  }
  function setFolder(next: string): void {
    setFolderState(next)
    params.set('folder', next)
  }
  const size = (bytes: number): string => formatFileSize(bytes, i18n.language)

  // A folder's subfolders and its own files, together by size, like a disk
  // usage tool: every folder opens (to its files, if nothing else), every
  // file opens its media page.
  const folderItems = useMemo((): StorageBarItem[] => {
    if (!data) return []
    const subfolders = data.folders
      .filter((entry: StorageFolder) => parentFolder(entry.path) === folder)
      .map((entry): StorageBarItem => {
        const name = ABSOLUTE.test(entry.path) ? entry.path : (entry.path.split('\\').pop() ?? '')
        return {
          key: `folder:${entry.path}`,
          kind: 'folder',
          label: name,
          bytes: entry.bytes,
          count: entry.count,
          actionLabel: t('storage.openFolder', { name }),
          onOpen: (): void => setFolder(entry.path)
        }
      })
    const files = data.files
      .filter((file) => file.folder === folder)
      .map(
        (file): StorageBarItem => ({
          key: `file:${file.id}`,
          kind: 'file',
          label: file.name,
          bytes: file.bytes,
          actionLabel: t('storage.openFile', { name: file.name }),
          onOpen: (): void => void navigate(PATH.MEDIA.replace(':id', file.id))
        })
      )
    return [...subfolders, ...files].sort((a, b) => b.bytes - a.bytes)
  }, [data, folder, t, navigate])

  function entityItems(entities: StorageEntity[], kind: CountEntityKind): StorageBarItem[] {
    return entities.map((entity) => ({
      key: entity.id,
      label: entity.name,
      bytes: entity.bytes,
      count: entity.count,
      actionLabel: t('storage.openInGallery', { name: entity.name }),
      onOpen: (): void =>
        openEntityInGallery(kind, entity.id, navigate, { prop: 'fileSize', desc: true })
    }))
  }

  const active = TABS.find((entry) => entry.tab === tab) ?? TABS[0]
  const items = !data || tab === 'folders' ? folderItems : entityItems(data[tab], ENTITY_KIND[tab])
  // A folder outside the source folder is one step, under its full path.
  const crumbs = folder === '' ? [] : ABSOLUTE.test(folder) ? [folder] : folder.split('\\')

  return (
    <div className="page manage-page storage-page">
      <h1 className="page-title">{t('storage.title')}</h1>

      {error && <p role="alert">{error}</p>}
      {loading && !data && <p className="loading-state">{t('gallery.loading')}</p>}

      {data && (
        <>
          <dl className="storage-tiles">
            <div className="storage-tile">
              <dt>{t('storage.library')}</dt>
              <dd className="storage-tile-value">{size(data.library.bytes)}</dd>
              <dd className="storage-tile-note">
                {t('storage.files', { count: data.library.count })}
                {data.library.unmeasured > 0 &&
                  ` · ${t('storage.unmeasured', { count: data.library.unmeasured })}`}
              </dd>
            </div>
            <div className="storage-tile">
              <dt>{t('nav.pending')}</dt>
              <dd className="storage-tile-value">{size(data.pending.bytes)}</dd>
              <dd className="storage-tile-note">
                {t('storage.files', { count: data.pending.count })}
              </dd>
            </div>
            <div className="storage-tile">
              <dt>{t('storage.reclaimable')}</dt>
              <dd className="storage-tile-value">{size(data.discarded.bytes)}</dd>
              <dd className="storage-tile-note">
                {t('storage.reclaimableNote', { count: data.discarded.count })}{' '}
                {data.discarded.count > 0 && (
                  <Link to={`${PATH.MANAGE}?tab=discarded`}>{t('storage.reviewDiscarded')}</Link>
                )}
              </dd>
            </div>
          </dl>

          <div className="manage-tabs" role="tablist" aria-label={t('storage.byLabel')}>
            {TABS.map((entry) => (
              <button
                key={entry.tab}
                type="button"
                role="tab"
                aria-selected={tab === entry.tab}
                className={
                  tab === entry.tab ? `manage-tab ${entry.className} active` : 'manage-tab'
                }
                onClick={() => setTab(entry.tab)}
              >
                {t(entry.labelKey)}
              </button>
            ))}
          </div>

          {tab === 'folders' ? (
            <nav className="storage-crumbs" aria-label={t('storage.tabFolders')}>
              <FolderOpen size={14} aria-hidden="true" />
              <button
                type="button"
                className={folder === '' ? 'storage-crumb is-current' : 'storage-crumb'}
                onClick={() => setFolder('')}
              >
                {t('mediaCompare.sourceRoot')}
              </button>
              {crumbs.map((segment, i) => {
                const path = crumbs.slice(0, i + 1).join('\\')
                return (
                  <span key={path} className="storage-crumb-step">
                    <ChevronRight size={14} aria-hidden="true" />
                    <button
                      type="button"
                      className={path === folder ? 'storage-crumb is-current' : 'storage-crumb'}
                      onClick={() => setFolder(path)}
                    >
                      {segment}
                    </button>
                  </span>
                )
              })}
            </nav>
          ) : (
            <p className="storage-note">{t('storage.overlapNote')}</p>
          )}

          <div className="manage-list-scroll" role="tabpanel">
            {items.length === 0 ? (
              <p className="storage-note">{t('storage.empty')}</p>
            ) : (
              <StorageBarList items={items} totalBytes={data.library.bytes} color={active.color} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
