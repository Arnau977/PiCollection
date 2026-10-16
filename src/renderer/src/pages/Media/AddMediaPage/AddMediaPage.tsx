import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '@renderer/app.routes.const'
import { MediaForm } from '../MediaForm/MediaForm'
import { FolderBrowser } from '../FolderBrowser/FolderBrowser'
import { ImportQueue } from '../ImportQueue/ImportQueue'
import './AddMediaPage.css'

type Tab = 'single' | 'folder'

export default function AddMediaPage(): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // The notification bell's "Import" opens straight on From folder.
  const location = useLocation()
  const [tab, setTab] = useState<Tab>(
    (location.state as { addMediaTab?: Tab } | null)?.addMediaTab === 'folder' ? 'folder' : 'single'
  )
  const [sourceFolder, setSourceFolder] = useState<string | null>(null)
  const [importSelection, setImportSelection] = useState<{
    files: string[]
    folders: string[]
  } | null>(null)

  useEffect(() => {
    window.api.sourceFolder.get().then((result) => {
      if (result.success) setSourceFolder(result.data)
    })
  }, [])

  function goToGallery(): void {
    navigate(PATH.GALLERY)
  }

  const showFolderBrowser = tab === 'folder' && sourceFolder && importSelection === null

  return (
    <div className="page add-media-page">
      <h1>{t('addMedia.title')}</h1>

      {/* Hidden while a batch import runs: switching to Single would drop
          the queue's untagged files, and the queue needs the height. The
          queue's own Close (with its exit dialog) is the way out. */}
      {importSelection === null && (
        <div className="add-media-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'single'}
            className={`add-media-tab${tab === 'single' ? ' is-active' : ''}`}
            onClick={() => setTab('single')}
          >
            {t('addMedia.tabSingle')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'folder'}
            className={`add-media-tab${tab === 'folder' ? ' is-active' : ''}`}
            onClick={() => setTab('folder')}
            disabled={!sourceFolder}
          >
            {t('addMedia.tabFolder')}
          </button>
        </div>
      )}

      {tab === 'single' && (
        // replace: true - without it, this push leaves the Add Media entry in
        // history, so MediaPage's "Back to gallery" (navigate(-1)) would land
        // back here instead of wherever the user opened Add Media from.
        <MediaForm
          onCancel={goToGallery}
          onSaved={(created) => navigate(PATH.MEDIA.replace(':id', created.id), { replace: true })}
          onReplaced={(target) =>
            navigate(PATH.MEDIA.replace(':id', target.id), { replace: true })
          }
        />
      )}

      {tab === 'folder' && !sourceFolder && (
        <p className="add-media-folder-hint">
          {t('addMedia.tabFolderDisabledHint')}{' '}
          <Link to={PATH.SETTINGS}>{t('addMedia.tabFolderDisabledHintLink')}</Link>
        </p>
      )}

      {showFolderBrowser && <FolderBrowser onStartImport={setImportSelection} />}

      {tab === 'folder' && sourceFolder && importSelection !== null && (
        <ImportQueue
          selection={importSelection}
          onClose={goToGallery}
          onLastSaved={(created) =>
            navigate(PATH.MEDIA.replace(':id', created.id), { replace: true })
          }
        />
      )}
    </div>
  )
}
