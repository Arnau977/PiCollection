import { useRef, useState } from 'react'

/** A tile that can be picked for import, in the order the grid shows it. */
export type SelectableItem =
  | { kind: 'folder'; path: string; fileCount: number }
  | { kind: 'file'; path: string }

export function itemKey(item: { kind: 'folder' | 'file'; path: string }): string {
  return `${item.kind}:${item.path}`
}

export interface FolderSelection {
  selectedFiles: Set<string>
  /** Each selected folder with its file count (files still to import, from its tile). */
  selectedFolders: Map<string, number>
  isSelected: (key: string) => boolean
  /** A plain click: flips one tile and makes it the anchor for Shift+click. */
  toggle: (item: SelectableItem) => void
  /** Shift+click: selects every item from the anchor to this one (inclusive). */
  selectRange: (item: SelectableItem, ordered: SelectableItem[]) => void
  setSelected: (items: SelectableItem[], selected: boolean) => void
}

/**
 * Selection for the batch-import browser. It's additive and survives
 * navigating between folders (the import takes picks from several places),
 * so bulk gestures only ever add or remove the items they're given - none
 * replaces the whole selection.
 */
export function useFolderSelection(): FolderSelection {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [selectedFolders, setSelectedFolders] = useState<Map<string, number>>(new Map())
  const anchorRef = useRef<string | null>(null)

  function isSelected(key: string): boolean {
    const separator = key.indexOf(':')
    const kind = key.slice(0, separator)
    const path = key.slice(separator + 1)
    return kind === 'folder' ? selectedFolders.has(path) : selectedFiles.has(path)
  }

  function setSelected(items: SelectableItem[], selected: boolean): void {
    const files = items.filter((item) => item.kind === 'file')
    const folders = items.filter(
      (item): item is Extract<SelectableItem, { kind: 'folder' }> => item.kind === 'folder'
    )
    if (files.length) {
      setSelectedFiles((prev) => {
        const next = new Set(prev)
        for (const file of files) {
          if (selected) next.add(file.path)
          else next.delete(file.path)
        }
        return next
      })
    }
    if (folders.length) {
      setSelectedFolders((prev) => {
        const next = new Map(prev)
        for (const folder of folders) {
          if (selected) next.set(folder.path, folder.fileCount)
          else next.delete(folder.path)
        }
        return next
      })
    }
  }

  function toggle(item: SelectableItem): void {
    anchorRef.current = itemKey(item)
    setSelected([item], !isSelected(itemKey(item)))
  }

  function selectRange(item: SelectableItem, ordered: SelectableItem[]): void {
    const keys = ordered.map(itemKey)
    const from = anchorRef.current === null ? -1 : keys.indexOf(anchorRef.current)
    const to = keys.indexOf(itemKey(item))
    if (from === -1 || to === -1) {
      toggle(item)
      return
    }
    setSelected(ordered.slice(Math.min(from, to), Math.max(from, to) + 1), true)
  }

  return { selectedFiles, selectedFolders, isSelected, toggle, selectRange, setSelected }
}
