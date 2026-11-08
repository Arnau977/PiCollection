import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Columns2, X } from 'lucide-react'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { MediaCompare } from '../MediaCompare/MediaCompare'
import { toCompared } from '../MediaCompare/toCompared'
import { copyImageViaCanvas } from '../MediaFileActions/copyImageViaCanvas'
import { Toast } from '../Toast/Toast'
import { getCompareChoice, setCompareChoice, useCompareChoice } from './compareChoice'
import { buildContextMenu, findContextTarget, type MediaAction } from './contextMenuItems'
import './ContextMenuHost.css'

/**
 * The app's right-click menu, a native one (Electron shows none by default):
 * cut/copy/paste in fields, copy for selected text, and file actions plus a
 * two-step compare on any element marked with `data-media-id`.
 */
export function ContextMenuHost(): JSX.Element {
  const { t } = useTranslation()
  const chosen = useCompareChoice()
  const [pair, setPair] = useState<[MediaModel, MediaModel] | null>(null)
  const [toast, setToastState] = useState<{ id: number; message: string; error?: boolean } | null>(
    null
  )
  const toastCount = useRef(0)
  const setToast = useCallback((next: { message: string; error?: boolean }): void => {
    toastCount.current += 1
    setToastState({ ...next, id: toastCount.current })
  }, [])
  const dismissToast = useCallback((): void => setToastState(null), [])
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    async function runMediaAction(
      action: MediaAction,
      media: MediaModel,
      link: HTMLAnchorElement | null
    ): Promise<void> {
      const t = tRef.current
      switch (action) {
        case 'open':
          link?.click()
          return
        case 'copyImage': {
          const result = await window.api.system.copyImageToClipboard(media.route)
          const copied = result.success || (await copyImageViaCanvas(toMediaUrl(media.route)))
          setToast(
            copied
              ? { message: t('contextMenu.imageCopied') }
              : { message: t('contextMenu.copyFailed'), error: true }
          )
          return
        }
        case 'copyLocation': {
          const result = await window.api.system.copyLocationToClipboard(media.route)
          setToast(
            result.success
              ? { message: t('contextMenu.locationCopied') }
              : { message: t('contextMenu.copyFailed'), error: true }
          )
          return
        }
        case 'showInFolder':
          await window.api.system.showInFolder(media.route)
          return
        case 'chooseCompare':
          setCompareChoice(media)
          return
        case 'clearCompare':
          setCompareChoice(null)
          return
        case 'compareWith': {
          const first = getCompareChoice()
          if (!first) return
          setCompareChoice(null)
          setPair([first, media])
        }
      }
    }

    async function handleContextMenu(event: MouseEvent): Promise<void> {
      const selection = window.getSelection()?.toString() ?? ''
      const target = findContextTarget(event.target, selection)
      if (!target) return
      event.preventDefault()

      let media: MediaModel | null = null
      if (target.kind === 'media') {
        const result = await window.api.media.getById(target.mediaId)
        media = result.success ? result.data : null
      }
      const items = buildContextMenu(target, tRef.current, media, getCompareChoice())
      if (items.length === 0) return
      const result = await window.api.system.showContextMenu(items)
      if (!result.success || !result.data || !media || target.kind !== 'media') return
      await runMediaAction(result.data as MediaAction, media, target.openLink)
    }

    const listener = (event: MouseEvent): void => void handleContextMenu(event)
    document.addEventListener('contextmenu', listener)
    return (): void => document.removeEventListener('contextmenu', listener)
  }, [setToast])

  return (
    <>
      {chosen &&
        createPortal(
          <div className="compare-choice" role="status">
            <Columns2 size={16} aria-hidden="true" />
            <p className="compare-choice-text">
              <span className="compare-choice-name">{chosen.name}</span>
              <span className="compare-choice-hint">{t('contextMenu.chosenHint')}</span>
            </p>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('contextMenu.clearCompare')}
              title={t('contextMenu.clearCompare')}
              onClick={() => setCompareChoice(null)}
            >
              <X size={14} />
            </button>
          </div>,
          document.body
        )}
      {pair && (
        <MediaCompare
          left={toCompared(pair[0])}
          right={toCompared(pair[1])}
          onClose={() => setPair(null)}
        />
      )}
      {toast &&
        createPortal(
          <Toast
            key={toast.id}
            message={toast.message}
            variant={toast.error ? 'error' : 'success'}
            durationMs={2500}
            onDismiss={dismissToast}
          />,
          document.body
        )}
    </>
  )
}
