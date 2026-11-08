import type { TFunction } from 'i18next'
import type { ContextMenuItem } from '@shared/ipc/contracts'
import type { MediaModel } from '@shared/models'

/** What was under the pointer, as far as the menu cares. */
export type ContextTarget =
  | { kind: 'text'; hasSelection: boolean; readOnly: boolean; secret: boolean }
  | { kind: 'selection' }
  | { kind: 'media'; mediaId: string; openLink: HTMLAnchorElement | null; hasSelection: boolean }

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', 'number', 'password'])

/** Finds the field, picture or selected text a right click landed on. */
export function findContextTarget(
  node: EventTarget | null,
  selection: string
): ContextTarget | null {
  if (!(node instanceof Element)) return selection ? { kind: 'selection' } : null

  const field = node.closest('input, textarea, [contenteditable="true"]')
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    if (field instanceof HTMLInputElement && !TEXT_INPUT_TYPES.has(field.type)) return null
    let hasSelection = false
    try {
      hasSelection = (field.selectionStart ?? 0) !== (field.selectionEnd ?? 0)
    } catch {
      // `number` inputs don't expose a selection.
    }
    return {
      kind: 'text',
      hasSelection,
      readOnly: field.readOnly || field.disabled,
      secret: field instanceof HTMLInputElement && field.type === 'password'
    }
  }
  if (field instanceof HTMLElement) {
    return { kind: 'text', hasSelection: selection.length > 0, readOnly: false, secret: false }
  }

  const mediaElement = node.closest<HTMLElement>('[data-media-id]')
  if (mediaElement?.dataset.mediaId) {
    const link = node.closest('a[href]') ?? mediaElement.querySelector('a[href]')
    return {
      kind: 'media',
      mediaId: mediaElement.dataset.mediaId,
      openLink: link instanceof HTMLAnchorElement ? link : null,
      hasSelection: selection.length > 0
    }
  }

  return selection ? { kind: 'selection' } : null
}

export type MediaAction =
  | 'open'
  | 'copyImage'
  | 'copyLocation'
  | 'showInFolder'
  | 'chooseCompare'
  | 'compareWith'
  | 'clearCompare'

const SEPARATOR: ContextMenuItem = { type: 'separator' }

/** Drops leading, trailing and doubled separators left by optional entries. */
function tidy(items: ContextMenuItem[]): ContextMenuItem[] {
  return items.filter((item, index, all) => {
    if (!('type' in item)) return true
    const previous = all[index - 1]
    return index > 0 && index < all.length - 1 && previous !== undefined && !('type' in previous)
  })
}

export function buildContextMenu(
  target: ContextTarget,
  t: TFunction,
  media: MediaModel | null = null,
  chosen: MediaModel | null = null
): ContextMenuItem[] {
  if (target.kind === 'text') {
    const canCopy = target.hasSelection && !target.secret
    return [
      {
        role: 'cut',
        label: t('contextMenu.cut'),
        enabled: canCopy && !target.readOnly
      },
      { role: 'copy', label: t('contextMenu.copy'), enabled: canCopy },
      { role: 'paste', label: t('contextMenu.paste'), enabled: !target.readOnly },
      SEPARATOR,
      { role: 'selectAll', label: t('contextMenu.selectAll') }
    ]
  }

  if (target.kind === 'selection') return [{ role: 'copy', label: t('contextMenu.copy') }]

  const items: ContextMenuItem[] = []
  if (target.hasSelection) items.push({ role: 'copy', label: t('contextMenu.copy') }, SEPARATOR)
  if (target.openLink) items.push({ id: 'open', label: t('contextMenu.open') }, SEPARATOR)
  if (!media) return tidy(items)

  const isVideo = media.type === 'video'
  // A video has no clipboard format worth offering; a GIF is copied as its
  // animated file, never a single frame.
  if (!isVideo) items.push({ id: 'copyImage', label: t('media.copyMedia') })
  items.push(
    { id: 'copyLocation', label: t('media.copyLocation') },
    { id: 'showInFolder', label: t('media.openInFolder') }
  )

  // MediaCompare slides two stills against each other, so no videos.
  if (!isVideo) {
    items.push(SEPARATOR)
    if (chosen && chosen.id === media.id) {
      items.push({ id: 'clearCompare', label: t('contextMenu.clearCompare') })
    } else if (chosen) {
      items.push(
        { id: 'compareWith', label: t('mediaCompare.openLabel', { name: chosen.name }) },
        { id: 'chooseCompare', label: t('contextMenu.chooseInstead') }
      )
    } else {
      items.push({ id: 'chooseCompare', label: t('contextMenu.chooseCompare') })
    }
  }
  return tidy(items)
}
