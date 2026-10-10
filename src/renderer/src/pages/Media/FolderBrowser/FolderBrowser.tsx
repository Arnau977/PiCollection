import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, Folder, Trash2 } from 'lucide-react'
import type { SourceFolderBrowseFile, SourceFolderBrowseResult } from '@shared/models'
import { toThumbUrl } from '@shared/utils/mediaUrl'
import { MediaThumb } from '../../../components/MediaThumb/MediaThumb'
import { Pagination } from '../../../components/Pagination/Pagination'
import { SHORTCUTS, useShortcut } from '../../../hooks/useShortcut'
import {
  itemKey,
  useFolderSelection,
  type ClickModifiers,
  type SelectableItem
} from './useFolderSelection'
import { MARQUEE_KEY_ATTR, useMarqueeSelection } from './useMarqueeSelection'
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
const FILES_PER_PAGE = 40
// Long enough to reliably distinguish a double-click's two clicks from two
// separate single clicks, short enough to still feel responsive.
const FOLDER_CLICK_DELAY_MS = 220

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

/** Already-added and discarded files show in the grid but can't be picked. */
function isPickable(file: SourceFolderBrowseFile): boolean {
  return !file.cataloged && !file.discarded
}

function toFileItem(file: SourceFolderBrowseFile): SelectableItem {
  return { kind: 'file', path: file.relativePath }
}

function modifiers(e: React.MouseEvent): ClickModifiers {
  return { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }
}

function isInsideFolder(relativePath: string, folder: string): boolean {
  return relativePath.startsWith(`${folder}/`) || relativePath.startsWith(`${folder}\\`)
}

/**
 * How many files "Import" will actually queue: each selected folder's
 * count (files still to import, subfolders included) plus each selected
 * file, skipping anything inside another selected folder - the import
 * dedupes those, so counting them again would overstate it.
 */
function countFilesToImport(files: Set<string>, folders: Map<string, number>): number {
  const selected = [...folders.keys()]
  const covered = (path: string): boolean =>
    selected.some((folder) => folder !== path && isInsideFolder(path, folder))
  let count = 0
  for (const [folder, fileCount] of folders) if (!covered(folder)) count += fileCount
  for (const file of files) if (!covered(file)) count += 1
  return count
}

export function FolderBrowser({ onStartImport }: FolderBrowserProps): JSX.Element {
  const { t } = useTranslation()
  const [currentPath, setCurrentPath] = useState('')
  const [state, setState] = useState<BrowseState>({ kind: 'loading' })
  // Folder counts are kept with the selection so the total survives navigating
  // away from where a folder was picked.
  const selection = useFolderSelection()
  const { selectedFiles, selectedFolders } = selection
  const scrollRef = useRef<HTMLDivElement>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [filePage, setFilePage] = useState(0)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  // Folders whose files are all added or discarded are hidden unless asked
  // for - after a few imports they'd otherwise crowd out the ones left to do.
  const [showFinished, setShowFinished] = useState(false)
  const previewTimer = useRef<ReturnType<typeof setTimeout>>()
  const folderClickTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect((): (() => void) => {
    return () => {
      clearTimeout(previewTimer.current)
      clearTimeout(folderClickTimer.current)
    }
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

  // Toggling selection on a plain click's mousedown-up-click sequence briefly
  // flashes the selected state before the matching double-click navigates
  // away. Defer the toggle so a following double-click can cancel it instead.
  // Shift+click (a range) applies at once: nobody double-clicks with Shift.
  function handleFolderClick(item: SelectableItem, e: React.MouseEvent): void {
    clearTimeout(folderClickTimer.current)
    const click = (): void => selection.click(item, modifiers(e), visibleItems, allItemsHere)
    if (e.shiftKey) click()
    else folderClickTimer.current = setTimeout(click, FOLDER_CLICK_DELAY_MS)
  }

  function handleFileClick(item: SelectableItem, e: React.MouseEvent): void {
    selection.click(item, modifiers(e), visibleItems, allItemsHere)
  }

  function handleFolderDoubleClick(relativePath: string): void {
    clearTimeout(folderClickTimer.current)
    navigateTo(relativePath)
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
  const importCount = countFilesToImport(selectedFiles, selectedFolders)
  const folders = state.kind === 'loaded' ? state.result.folders : []
  const finishedCount = folders.filter((folder) => folder.fileCount === 0).length
  const shownFolders = showFinished ? folders : folders.filter((folder) => folder.fileCount > 0)
  const files = state.kind === 'loaded' ? state.result.files : []
  const pageFiles = files.slice(filePage * FILES_PER_PAGE, (filePage + 1) * FILES_PER_PAGE)
  const selectableFolders: SelectableItem[] = folders
    .filter((folder) => folder.fileCount > 0)
    .map((folder) => ({ kind: 'folder', path: folder.relativePath, fileCount: folder.fileCount }))
  // In grid order, for Shift+click ranges: folders only show on the first page.
  const visibleItems: SelectableItem[] = [
    ...(filePage === 0 ? selectableFolders : []),
    ...pageFiles.filter(isPickable).map(toFileItem)
  ]
  // Every page of this folder, not just the one on screen.
  const allItemsHere: SelectableItem[] = [
    ...selectableFolders,
    ...files.filter(isPickable).map(toFileItem)
  ]

  const marquee = useMarqueeSelection({
    containerRef: scrollRef,
    // The page's side margins count too, not just the gaps in the grid.
    surfaceSelector: '.app-content',
    onCommit: (keys, mode) => {
      const picked = new Set(keys)
      const covered = visibleItems.filter((item) => picked.has(itemKey(item)))
      if (mode === 'replace') {
        selection.replaceWithin(allItemsHere, covered)
        return
      }
      selection.setSelected(covered.filter((item) => !selection.isSelected(itemKey(item))), true)
      selection.setSelected(covered.filter((item) => selection.isSelected(itemKey(item))), false)
    },
    onEmptyClick: (ctrl) => {
      if (!ctrl) selection.setSelected(allItemsHere, false)
    }
  })

  useShortcut(SHORTCUTS.selectAll, () => selection.setSelected(allItemsHere, true))
  useShortcut(SHORTCUTS.clearSelection, () => selection.setSelected(allItemsHere, false))

  /** What a tile shows: its selection, or what releasing the rectangle will make it. */
  function showsSelected(item: SelectableItem): boolean {
    const key = itemKey(item)
    const selected = selection.isSelected(key)
    if (!marquee.preview) return selected
    const covered = marquee.preview.keys.has(key)
    return marquee.preview.mode === 'replace' ? covered : selected !== covered
  }

  return (
    <>
      <div className="folder-browser">
        <nav className="folder-browser-breadcrumb" aria-label={t('folderBrowser.breadcrumbLabel')}>
          <Folder size={15} className="folder-browser-breadcrumb-icon" aria-hidden="true" />
          <button
            type="button"
            className={`folder-browser-crumb${breadcrumbSegments.length === 0 ? ' is-current' : ''}`}
            onClick={() => navigateTo('')}
          >
            {t('folderBrowser.root')}
          </button>
          {breadcrumbSegments.map((segment, index) => {
            const pathUpToHere = breadcrumbSegments.slice(0, index + 1).join('/')
            const isCurrent = index === breadcrumbSegments.length - 1
            return (
              <Fragment key={pathUpToHere}>
                <ChevronRight size={14} className="folder-browser-crumb-sep" aria-hidden="true" />
                <button
                  type="button"
                  className={`folder-browser-crumb${isCurrent ? ' is-current' : ''}`}
                  onClick={() => navigateTo(pathUpToHere)}
                >
                  {segment}
                </button>
              </Fragment>
            )
          })}
          {finishedCount > 0 && (
            <label className="folder-browser-show-finished">
              <input
                type="checkbox"
                checked={showFinished}
                onChange={(e) => setShowFinished(e.target.checked)}
              />
              {t('folderBrowser.showFinished', { count: finishedCount })}
            </label>
          )}
        </nav>

        <div
          ref={scrollRef}
          className={`folder-browser-scroll${marquee.rect ? ' is-marquee-dragging' : ''}`}
        >
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
              {filePage === 0 &&
                shownFolders.map((folder) => {
                  // Still opens on double-click (to see what's in it), but
                  // there's nothing in it to select for import.
                  const finished = folder.fileCount === 0
                  const item: SelectableItem = {
                    kind: 'folder',
                    path: folder.relativePath,
                    fileCount: folder.fileCount
                  }
                  const selected = showsSelected(item)
                  return (
                    <button
                      key={folder.relativePath}
                      type="button"
                      title={folder.name}
                      className={`folder-browser-tile${selected ? ' is-selected' : ''}${finished ? ' is-cataloged' : ''}`}
                      {...(!finished && { [MARQUEE_KEY_ATTR]: itemKey(item) })}
                      onClick={(e) => !finished && handleFolderClick(item, e)}
                      onDoubleClick={() => handleFolderDoubleClick(folder.relativePath)}
                    >
                      <span className="folder-browser-tile-thumb">
                        <Folder size={32} aria-hidden="true" />
                        {finished ? (
                          <span className="folder-browser-tile-badge">
                            <Check size={12} aria-hidden="true" />
                            {t('folderBrowser.nothingLeft')}
                          </span>
                        ) : (
                          <span
                            className="folder-browser-tile-count-badge"
                            title={t('folderBrowser.fileCount', { count: folder.fileCount })}
                          >
                            {folder.fileCount.toLocaleString()}
                          </span>
                        )}
                        {selected && (
                          <span className="folder-browser-tile-selected-badge">
                            <Check size={14} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="folder-browser-tile-name">{folder.name}</span>
                    </button>
                  )
                })}
              {pageFiles.map((file) => {
                const item = toFileItem(file)
                const selected = showsSelected(item)
                return (
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
                      title={
                        file.discarded
                          ? `${file.name} - ${t('folderBrowser.discardedTitle')}`
                          : file.name
                      }
                      className={`folder-browser-tile${selected ? ' is-selected' : ''}${file.cataloged ? ' is-cataloged' : ''}${file.discarded ? ' is-discarded' : ''}`}
                      {...(isPickable(file) && { [MARQUEE_KEY_ATTR]: itemKey(item) })}
                      onClick={(e) => handleFileClick(item, e)}
                      // A batch import skips discarded files anyway.
                      disabled={file.cataloged || file.discarded}
                    >
                      <span className="folder-browser-tile-thumb">
                        <MediaThumb type={file.type} route={file.relativePath} alt={file.name} />
                        {file.cataloged && (
                          <span className="folder-browser-tile-badge">
                            <Check size={12} aria-hidden="true" />
                            {t('folderBrowser.cataloged')}
                          </span>
                        )}
                        {file.discarded && (
                          <span className="folder-browser-tile-badge is-discarded">
                            <Trash2 size={12} aria-hidden="true" />
                            {t('folderBrowser.discarded')}
                          </span>
                        )}
                        {selected && (
                          <span className="folder-browser-tile-selected-badge">
                            <Check size={14} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="folder-browser-tile-name">{file.name}</span>
                    </button>
                  </div>
                )
              })}
              {shownFolders.length === 0 && state.result.files.length === 0 && (
                <p className="folder-browser-status">
                  {finishedCount > 0 ? t('folderBrowser.allFinished') : t('folderBrowser.empty')}
                </p>
              )}
            </div>
          )}
        </div>

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
          <p className="folder-browser-hint">{t('folderBrowser.selectionHint')}</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={importCount === 0}
            onClick={() =>
              onStartImport({ files: [...selectedFiles], folders: [...selectedFolders.keys()] })
            }
          >
            {t('folderBrowser.importFiles', { count: importCount })}
          </button>
        </div>
      </div>
      {marquee.rect &&
        createPortal(
          <div
            className="folder-browser-marquee"
            style={{
              left: marquee.rect.left,
              top: marquee.rect.top,
              width: marquee.rect.width,
              height: marquee.rect.height
            }}
            aria-hidden="true"
          />,
          document.body
        )}
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
