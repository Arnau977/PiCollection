import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Check, Folder } from 'lucide-react'
import type { SourceFolderBrowseFile, SourceFolderBrowseResult } from '@shared/models'
import { toThumbUrl } from '@shared/utils/mediaUrl'
import { MediaThumb } from '../../components/MediaThumb/MediaThumb'
import { Pagination } from '../../components/Pagination/Pagination'
import './FolderBrowser.css'

interface FolderBrowserProps {
  onStartImport: (selection: { files: string[]; folders: string[] }) => void
}

type BrowseState =
  | { kind: 'loading' }
  | { kind: 'loaded'; result: SourceFolderBrowseResult }
  | { kind: 'error'; message: string }

interface PreviewState {
  file: SourceFolderBrowseFile
  top: number
  left: number
  size: number
}

const PREVIEW_SIZE = 320
const PREVIEW_MARGIN = 12
const PREVIEW_DELAY_MS = 150
const FILES_PER_PAGE = 60

/** Keeps the enlarged preview clear of the viewport edges: flips to the tile's
 * left when there's no room on the right, and clamps vertically instead of
 * flipping (a tile's row position varies too much for a simple above/below flip). */
function computePreviewPosition(anchor: DOMRect): { top: number; left: number; size: number } {
  const size = Math.min(
    PREVIEW_SIZE,
    window.innerWidth - PREVIEW_MARGIN * 2,
    window.innerHeight - PREVIEW_MARGIN * 2
  )

  let left = anchor.right + PREVIEW_MARGIN
  if (left + size > window.innerWidth - PREVIEW_MARGIN) {
    left = anchor.left - size - PREVIEW_MARGIN
  }
  left = Math.min(Math.max(left, PREVIEW_MARGIN), window.innerWidth - size - PREVIEW_MARGIN)

  let top = anchor.top
  top = Math.min(Math.max(top, PREVIEW_MARGIN), window.innerHeight - size - PREVIEW_MARGIN)

  return { top, left, size }
}

export function FolderBrowser({ onStartImport }: FolderBrowserProps): JSX.Element {
  const { t } = useTranslation()
  const [currentPath, setCurrentPath] = useState('')
  const [state, setState] = useState<BrowseState>({ kind: 'loading' })
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [reloadToken, setReloadToken] = useState(0)
  const [filePage, setFilePage] = useState(0)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect((): (() => void) => {
    return () => clearTimeout(previewTimer.current)
  }, [])

  useEffect((): (() => void) => {
    let cancelled = false
    setState({ kind: 'loading' })
    setFilePage(0)
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
  }, [currentPath, reloadToken])

  function retry(): void {
    setReloadToken((token) => token + 1)
  }

  // setCurrentPath alone won't reset the page when navigating to the folder
  // that's already current (e.g. clicking the root breadcrumb while at root):
  // React bails out of the state update - and the effect that resets
  // filePage - when the value is unchanged. Reset explicitly here instead.
  function navigateTo(path: string): void {
    setFilePage(0)
    setCurrentPath(path)
  }

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

  function startPreview(file: SourceFolderBrowseFile, anchor: HTMLElement): void {
    clearTimeout(previewTimer.current)
    const rect = anchor.getBoundingClientRect()
    previewTimer.current = setTimeout(() => {
      setPreview({ file, ...computePreviewPosition(rect) })
    }, PREVIEW_DELAY_MS)
  }

  function endPreview(): void {
    clearTimeout(previewTimer.current)
    setPreview(null)
  }

  const breadcrumbSegments = currentPath === '' ? [] : currentPath.split(/[/\\]/)
  const selectedCount = selectedFiles.size + selectedFolders.size

  return (
    <>
      <div className="folder-browser">
        <nav className="folder-browser-breadcrumb" aria-label={t('folderBrowser.breadcrumbLabel')}>
          <button type="button" className="folder-browser-crumb" onClick={() => navigateTo('')}>
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
                  onClick={() => navigateTo(pathUpToHere)}
                >
                  {segment}
                </button>
              </span>
            )
          })}
        </nav>

        {state.kind === 'loading' && (
          <p className="folder-browser-status">{t('folderBrowser.loading')}</p>
        )}
        {state.kind === 'error' && (
          <div className="folder-browser-error">
            <p role="alert">{state.message}</p>
            <button type="button" className="btn" onClick={retry}>
              {t('folderBrowser.retry')}
            </button>
          </div>
        )}

        {state.kind === 'loaded' && (
          <div className="folder-browser-grid">
            {state.result.folders.map((folder) => (
              <button
                key={folder.relativePath}
                type="button"
                title={folder.name}
                className={`folder-browser-tile${selectedFolders.has(folder.relativePath) ? ' is-selected' : ''}`}
                onClick={() => toggleFolder(folder.relativePath)}
                onDoubleClick={() => navigateTo(folder.relativePath)}
              >
                <span className="folder-browser-tile-thumb">
                  <Folder size={32} aria-hidden="true" />
                  {selectedFolders.has(folder.relativePath) && (
                    <span className="folder-browser-tile-selected-badge">
                      <Check size={14} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="folder-browser-tile-name">{folder.name}</span>
              </button>
            ))}
            {state.result.files
              .slice(filePage * FILES_PER_PAGE, (filePage + 1) * FILES_PER_PAGE)
              .map((file) => (
                // Hover detection lives on this wrapper, not the button: disabled
                // buttons (cataloged files) don't dispatch mouse events, and the
                // preview should still work for them.
                <div
                  key={file.relativePath}
                  className="folder-browser-tile-wrap"
                  onMouseEnter={(e) => {
                    // The wrapper is `display: contents` (no box of its own, so no
                    // rect) - the button underneath is the real anchor.
                    const button = e.currentTarget.querySelector('button')
                    if (button) startPreview(file, button)
                  }}
                  onMouseLeave={endPreview}
                >
                  <button
                    type="button"
                    title={file.name}
                    className={`folder-browser-tile${selectedFiles.has(file.relativePath) ? ' is-selected' : ''}${file.cataloged ? ' is-cataloged' : ''}`}
                    onClick={() => toggleFile(file.relativePath)}
                    disabled={file.cataloged}
                  >
                    <span className="folder-browser-tile-thumb">
                      <MediaThumb type={file.type} route={file.relativePath} alt={file.name} />
                      {file.cataloged && (
                        <span className="folder-browser-tile-badge">
                          <Check size={12} aria-hidden="true" />
                          {t('folderBrowser.cataloged')}
                        </span>
                      )}
                      {selectedFiles.has(file.relativePath) && (
                        <span className="folder-browser-tile-selected-badge">
                          <Check size={14} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <span className="folder-browser-tile-name">{file.name}</span>
                  </button>
                </div>
              ))}
            {state.result.folders.length === 0 && state.result.files.length === 0 && (
              <p className="folder-browser-status">{t('folderBrowser.empty')}</p>
            )}
          </div>
        )}

        {state.kind === 'loaded' && state.result.files.length > FILES_PER_PAGE && (
          <div className="folder-browser-pagination">
            <Pagination
              page={filePage}
              totalPages={Math.ceil(state.result.files.length / FILES_PER_PAGE)}
              onPageChange={setFilePage}
            />
          </div>
        )}

        <div className="folder-browser-actions">
          <span className="folder-browser-actions-count">
            {t('folderBrowser.selectedCount', { count: selectedCount })}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedCount === 0}
            onClick={() =>
              onStartImport({ files: [...selectedFiles], folders: [...selectedFolders] })
            }
          >
            {t('folderBrowser.importSelected', { count: selectedCount })}
          </button>
        </div>
      </div>
      {preview &&
        createPortal(
          <div
            className="folder-browser-preview"
            style={{
              top: preview.top,
              left: preview.left,
              width: preview.size,
              height: preview.size
            }}
          >
            <img src={toThumbUrl(preview.file.relativePath)} alt={preview.file.name} />
          </div>,
          document.body
        )}
    </>
  )
}
