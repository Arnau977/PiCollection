import { useRef, useState } from 'react'

/** A tile that can be picked for import, in the order the grid shows it. */
export type SelectableItem =
  | { kind: 'folder'; path: string; fileCount: number }
  | { kind: 'file'; path: string }

export function itemKey(item: { kind: 'folder' | 'file'; path: string }): string {
  return `${item.kind}:${item.path}`
}

export interface ClickModifiers {
  ctrl: boolean
  shift: boolean
}

export interface FolderSelection {
  selectedFiles: Set<string>
  /** Each selected folder with its file count (files still to import, from its tile). */
  selectedFolders: Map<string, number>
  isSelected: (key: string) => boolean
  /**
   * A click on a tile, as in Windows Explorer: plain selects only it, Ctrl
   * flips it, Shift selects the range from the last clicked tile, and
   * Ctrl+Shift adds that range. `ordered` is the grid on screen, `scope`
   * everything in the current folder.
   */
  click: (
    item: SelectableItem,
    modifiers: ClickModifiers,
    ordered: SelectableItem[],
    scope: SelectableItem[]
  ) => void
  /** Makes `items` the whole selection within `scope`. */
  replaceWithin: (scope: SelectableItem[], items: SelectableItem[]) => void
  setSelected: (items: SelectableItem[], selected: boolean) => void
}

/**
 * Selection for the batch-import browser. It follows Windows Explorer's
 * rules, but scoped to the folder on screen: the import gathers picks from
 * several folders, so "replace the selection" never drops what was picked
 * in another folder (that would happen out of sight).
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

  function replaceWithin(scope: SelectableItem[], items: SelectableItem[]): void {
    const keep = new Set(items.map(itemKey))
    setSelected(
      scope.filter((item) => !keep.has(itemKey(item))),
      false
    )
    setSelected(items, true)
  }

  function click(
    item: SelectableItem,
    { ctrl, shift }: ClickModifiers,
    ordered: SelectableItem[],
    scope: SelectableItem[]
  ): void {
    const key = itemKey(item)
    if (shift) {
      const keys = ordered.map(itemKey)
      const from = anchorRef.current === null ? -1 : keys.indexOf(anchorRef.current)
      const to = keys.indexOf(key)
      if (from !== -1 && to !== -1) {
        const range = ordered.slice(Math.min(from, to), Math.max(from, to) + 1)
        // The anchor stays put, so the next Shift+click re-ranges from it.
        if (ctrl) setSelected(range, true)
        else replaceWithin(scope, range)
        return
      }
    }
    anchorRef.current = key
    if (ctrl) setSelected([item], !isSelected(key))
    else replaceWithin(scope, [item])
  }

  return { selectedFiles, selectedFolders, isSelected, click, replaceWithin, setSelected }
}
