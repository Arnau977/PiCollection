import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExpandedMediaFile, MediaModel } from '@shared/models'
import { deriveMediaName } from '@shared/utils'
import { MediaForm } from './MediaForm'
import { ImportQueueExitDialog } from './ImportQueueExitDialog'

interface ImportQueueProps {
  selection: { files: string[]; folders: string[] }
  onClose: () => void
  onLastSaved: (media: MediaModel) => void
}

type QueueState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: ExpandedMediaFile[]; index: number }
  | { kind: 'error'; message: string }

export function ImportQueue({ selection, onClose, onLastSaved }: ImportQueueProps): JSX.Element | null {
  const { t } = useTranslation()
  const [state, setState] = useState<QueueState>({ kind: 'loading' })
  const [showExitDialog, setShowExitDialog] = useState(false)
  // "Guardar" persists the current item but no longer advances the queue by
  // itself - tracked here so that moving past the *last* item (via
  // "Siguiente") can still open the item that was actually saved, instead of
  // just closing blindly the way skipping an unsaved item does.
  const [currentSaved, setCurrentSaved] = useState<MediaModel | null>(null)

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

  if (state.kind === 'loading') return <p className="settings-version">{t('importQueue.loading')}</p>
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
  const remaining = items.length - index

  function advance(): void {
    if (index + 1 >= items.length) {
      if (currentSaved) onLastSaved(currentSaved)
      else onClose()
      return
    }
    setCurrentSaved(null)
    setState({ kind: 'ready', items, index: index + 1 })
  }

  // Going back re-shows the file's own picked route (`key={current.route}`
  // remounts MediaForm), but any tags typed for the item being left behind
  // are lost unless "Guardar" was pressed first - same trade-off "Siguiente"
  // already has when skipping an unsaved item.
  function goBack(): void {
    if (index === 0) return
    setCurrentSaved(null)
    setState({ kind: 'ready', items, index: index - 1 })
  }

  function handleSaved(media: MediaModel): void {
    setCurrentSaved(media)
  }

  function handleCloseClick(): void {
    if (remaining > 0) {
      setShowExitDialog(true)
      return
    }
    onClose()
  }

  async function handleAddRemainingToPending(): Promise<void> {
    setShowExitDialog(false)
    await Promise.all(
      items.slice(index).map((file) =>
        window.api.media.create({
          name: deriveMediaName(file.fileName),
          type: file.type,
          route: file.route,
          sfw: true,
          isAiGenerated: false,
          pendingTagging: true
        })
      )
    )
    onClose()
  }

  function handleDiscard(): void {
    setShowExitDialog(false)
    onClose()
  }

  return (
    <>
      <MediaForm
        key={current.route}
        initialFile={{ route: current.route, name: deriveMediaName(current.fileName), type: current.type }}
        queueInfo={{
          current: index + 1,
          total: items.length,
          onNext: advance,
          onPrevious: index > 0 ? goBack : undefined
        }}
        onCancel={handleCloseClick}
        onSaved={handleSaved}
      />
      {showExitDialog && (
        <ImportQueueExitDialog
          remaining={remaining}
          onAddToPending={handleAddRemainingToPending}
          onDiscard={handleDiscard}
          onKeepEditing={() => setShowExitDialog(false)}
        />
      )}
    </>
  )
}
