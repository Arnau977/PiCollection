import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExpandedMediaFile, MediaModel } from '@shared/models'
import { deriveMediaName } from '@shared/utils'
import { MediaForm } from '../MediaForm/MediaForm'
import { ImportQueueExitDialog } from '../ImportQueueExitDialog/ImportQueueExitDialog'
import { Toast } from '../../../components/Toast/Toast'
import { useConfirm } from '../../../components/ConfirmDialog/ConfirmDialogContext'
import './ImportQueue.css'

interface ImportQueueProps {
  selection: { files: string[]; folders: string[] }
  onClose: () => void
  onLastSaved: (media: MediaModel) => void
}

type QueueState =
  | { kind: 'loading' }
  | {
      kind: 'ready'
      items: ExpandedMediaFile[]
      index: number
      /** Set when the item was saved earlier in this session: it reopens in edit mode. */
      openedMedia?: MediaModel
    }
  | { kind: 'error'; message: string }

export function ImportQueue({
  selection,
  onClose,
  onLastSaved
}: ImportQueueProps): JSX.Element | null {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [state, setState] = useState<QueueState>({ kind: 'loading' })
  const [showExitDialog, setShowExitDialog] = useState(false)
  // Every item saved in this session, by route. "Guardar" doesn't advance the
  // queue, so moving past the *last* item can still open the one actually
  // saved; and going back to a saved item reopens it in edit mode - as a new
  // file it would be flagged as a duplicate of itself and refuse to save.
  const [saved, setSaved] = useState<ReadonlyMap<string, MediaModel>>(() => new Map())
  const [showSentToPendingToast, setShowSentToPendingToast] = useState(false)
  // Set for the whole duration of the "add remaining to pending" bulk create.
  // While it's true a full-screen overlay blocks every control (Close, Next,
  // Previous, the form itself) so the batch can't be re-triggered or the
  // queue navigated out from under it - the exact re-entrancy that produced
  // hundreds of duplicate rows before. `runningRef` guards the synchronous
  // gap before `busy` re-renders against a double-click.
  const [busy, setBusy] = useState(false)
  const runningRef = useRef(false)

  useEffect((): (() => void) => {
    let cancelled = false
    window.api.sourceFolder.expandSelection(selection).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setState({ kind: 'error', message: result.error.message })
        return
      }
      setState({ kind: 'ready', items: result.data, index: 0 })
    })
    return () => {
      cancelled = true
    }
    // `selection` is only ever set once by the parent when the queue mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state.kind === 'loading')
    return <p className="settings-version">{t('importQueue.loading')}</p>
  if (state.kind === 'error') return <p role="alert">{state.message}</p>

  const { items, index } = state

  if (items.length === 0) {
    return (
      <div className="import-queue-empty">
        <p>{t('importQueue.empty')}</p>
        <button type="button" className="btn" onClick={onClose}>
          {t('importQueue.close')}
        </button>
      </div>
    )
  }

  const current = items[index]
  const currentSaved = saved.get(current.route)
  // Items already saved in this session aren't sent to Pending again.
  const remainingItems = items.slice(index).filter((file) => !saved.has(file.route))
  const remaining = remainingItems.length

  function open(nextIndex: number): void {
    setState({
      kind: 'ready',
      items,
      index: nextIndex,
      openedMedia: saved.get(items[nextIndex].route)
    })
  }

  function goToNextOrFinish(onFinish: () => void): void {
    if (index + 1 >= items.length) {
      onFinish()
      return
    }
    open(index + 1)
  }

  function advance(): void {
    if (busy) return
    goToNextOrFinish(() => (currentSaved ? onLastSaved(currentSaved) : onClose()))
  }

  // Unlike Guardar, sending to Pending is itself a "move on" gesture - it
  // takes the file out of this editing session immediately instead of
  // waiting for a separate Siguiente click. On the last item there's nothing
  // saved-and-ready-to-review the way onLastSaved expects (the whole point
  // was deferring review), so this just closes the queue instead.
  function handleSentToPending(): void {
    setShowSentToPendingToast(true)
    goToNextOrFinish(onClose)
  }

  // Going back re-shows the file's own picked route (`key={current.route}`
  // remounts MediaForm), but any tags typed for the item being left behind
  // are lost unless "Guardar" was pressed first - same trade-off "Siguiente"
  // already has when skipping an unsaved item.
  function goBack(): void {
    if (busy || index === 0) return
    open(index - 1)
  }

  function handleSaved(media: MediaModel): void {
    setSaved((prev) => new Map(prev).set(current.route, media))
  }

  function handleCloseClick(): void {
    if (busy) return
    if (remaining > 0) {
      setShowExitDialog(true)
      return
    }
    onClose()
  }

  async function handleAddRemainingToPending(): Promise<void> {
    if (runningRef.current) return
    runningRef.current = true
    setBusy(true)
    setShowExitDialog(false)

    const result = await window.api.media.createMany(
      remainingItems.map((file) => ({
        name: deriveMediaName(file.fileName),
        type: file.type,
        route: file.route,
        sfw: true,
        isAiGenerated: false,
        pendingTagging: true
      }))
    )

    if (result.success) {
      onClose()
      return
    }
    runningRef.current = false
    setBusy(false)
    setState({ kind: 'error', message: result.error.message })
  }

  // The same bulk send as the exit dialog's, reachable without leaving the
  // queue. It skips review for every remaining file, so it asks first.
  async function handleSendRemainingToPending(): Promise<void> {
    if (busy) return
    const ok = await confirm({
      message: t('importQueue.sendRemainingConfirm', { count: remaining }),
      confirmLabel: t('importQueue.sendRemainingToPending', { count: remaining })
    })
    if (ok) await handleAddRemainingToPending()
  }

  function handleDiscard(): void {
    setShowExitDialog(false)
    onClose()
  }

  return (
    <>
      <MediaForm
        key={current.route}
        media={state.openedMedia}
        initialFile={
          state.openedMedia
            ? undefined
            : {
                route: current.route,
                name: deriveMediaName(current.fileName),
                type: current.type
              }
        }
        queueInfo={{
          current: index + 1,
          total: items.length,
          onNext: advance,
          onPrevious: index > 0 ? goBack : undefined,
          onSendRemainingToPending: remaining > 0 ? handleSendRemainingToPending : undefined,
          remaining
        }}
        onCancel={handleCloseClick}
        onSaved={handleSaved}
        onSentToPending={handleSentToPending}
      />
      {showSentToPendingToast && (
        <Toast
          message={t('importQueue.sentToPending')}
          onDismiss={() => setShowSentToPendingToast(false)}
        />
      )}
      {showExitDialog && (
        <ImportQueueExitDialog
          remaining={remaining}
          onAddToPending={handleAddRemainingToPending}
          onDiscard={handleDiscard}
          onKeepEditing={() => setShowExitDialog(false)}
        />
      )}
      {busy && (
        <div className="import-queue-busy" role="alert" aria-busy="true">
          <div className="import-queue-busy-spinner" aria-hidden="true" />
          <p className="import-queue-busy-label">
            {t('importQueue.addingToPending', { count: remaining })}
          </p>
        </div>
      )}
    </>
  )
}
