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
      onClose()
      return
    }
    setState({ kind: 'ready', items, index: index + 1 })
  }

  function handleSaved(media: MediaModel): void {
    if (index + 1 >= items.length) {
      onLastSaved(media)
      return
    }
    setState({ kind: 'ready', items, index: index + 1 })
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
        queueInfo={{ current: index + 1, total: items.length, onSkip: advance }}
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
