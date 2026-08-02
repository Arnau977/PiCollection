import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Folder } from 'lucide-react'
import type { SourceFolderBrowseResult } from '@shared/models'
import { MediaThumb } from '../../components/MediaThumb/MediaThumb'
import './FolderBrowser.css'

interface FolderBrowserProps {
  onStartImport: (selection: { files: string[]; folders: string[] }) => void
}

type BrowseState =
  | { kind: 'loading' }
  | { kind: 'loaded'; result: SourceFolderBrowseResult }
  | { kind: 'error'; message: string }

export function FolderBrowser({ onStartImport }: FolderBrowserProps): JSX.Element {
  const { t } = useTranslation()
  const [currentPath, setCurrentPath] = useState('')
  const [state, setState] = useState<BrowseState>({ kind: 'loading' })
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    window.api.sourceFolder.browse(currentPath).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setState({ kind: 'error', message: result.error.message })
        return
      }
      setState({ kind: 'loaded', result: result.data })
    })
    return () => {
      cancelled = true
    }
  }, [currentPath])

  function toggleFile(relativePath: string): void {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(relativePath)) next.delete(relativePath)
      else next.add(relativePath)
      return next
    })
  }

  function toggleFolder(relativePath: string): void {
    setSelectedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(relativePath)) next.delete(relativePath)
      else next.add(relativePath)
      return next
    })
  }

  const breadcrumbSegments = currentPath === '' ? [] : currentPath.split(/[/\\]/)
  const selectedCount = selectedFiles.size + selectedFolders.size

  return (
    <div className="folder-browser">
      <nav className="folder-browser-breadcrumb" aria-label={t('folderBrowser.breadcrumbLabel')}>
        <button type="button" className="folder-browser-crumb" onClick={() => setCurrentPath('')}>
          {t('folderBrowser.root')}
        </button>
        {breadcrumbSegments.map((segment, index) => {
          const pathUpToHere = breadcrumbSegments.slice(0, index + 1).join('/')
          return (
            <span key={pathUpToHere}>
              {' / '}
              <button
                type="button"
                className="folder-browser-crumb"
                onClick={() => setCurrentPath(pathUpToHere)}
              >
                {segment}
              </button>
            </span>
          )
        })}
      </nav>

      {state.kind === 'loading' && <p className="settings-version">{t('folderBrowser.loading')}</p>}
      {state.kind === 'error' && <p role="alert">{state.message}</p>}

      {state.kind === 'loaded' && (
        <div className="folder-browser-grid">
          {state.result.folders.map((folder) => (
            <button
              key={folder.relativePath}
              type="button"
              className={`folder-browser-tile${selectedFolders.has(folder.relativePath) ? ' is-selected' : ''}`}
              onClick={() => toggleFolder(folder.relativePath)}
              onDoubleClick={() => setCurrentPath(folder.relativePath)}
            >
              <Folder size={32} aria-hidden="true" />
              <span>{folder.name}</span>
            </button>
          ))}
          {state.result.files.map((file) => (
            <button
              key={file.relativePath}
              type="button"
              className={`folder-browser-tile${selectedFiles.has(file.relativePath) ? ' is-selected' : ''}`}
              onClick={() => toggleFile(file.relativePath)}
              disabled={file.cataloged}
            >
              <MediaThumb type={file.type} route={file.relativePath} alt={file.name} />
              <span>{file.name}</span>
              {file.cataloged && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
          {state.result.folders.length === 0 && state.result.files.length === 0 && (
            <p className="settings-version">{t('folderBrowser.empty')}</p>
          )}
        </div>
      )}

      <div className="folder-browser-actions">
        <span>{t('folderBrowser.selectedCount', { count: selectedCount })}</span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={selectedCount === 0}
          onClick={() => onStartImport({ files: [...selectedFiles], folders: [...selectedFolders] })}
        >
          {t('folderBrowser.importSelected', { count: selectedCount })}
        </button>
      </div>
    </div>
  )
}
