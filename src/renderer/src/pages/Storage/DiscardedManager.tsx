import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import type { DiscardedMediaModel } from '@shared/models'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { EntityThumbnail } from '../../components/EntityThumbnail/EntityThumbnail'
import { StableLabel } from '../../components/StableLabel/StableLabel'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { splitRoute } from '../../utils/splitRoute'

/**
 * Files taken out of the app (deleted, or discarded from a batch import)
 * that are still on disk: each can go to the Recycle Bin or stay where it
 * is. Nothing here touches the library itself.
 */
export function DiscardedManager(): JSX.Element {
  const { t, i18n } = useTranslation()
  const confirm = useConfirm()
  const [items, setItems] = useState<DiscardedMediaModel[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // One operation at a time: it locks every button in the list.
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  async function load(): Promise<void> {
    const result = await window.api.discardedMedia.list()
    if (result.success) setItems(result.data)
    else setError(result.error.message)
  }

  useEffect(() => {
    void load()
  }, [])

  async function run(task: () => Promise<string | null>): Promise<void> {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(await task())
    await load()
    busyRef.current = false
    setBusy(false)
  }

  function failedMessage(failed: number): string | null {
    return failed > 0 ? t('discarded.trashFailed', { count: failed }) : null
  }

  function trash(ids: string[]): Promise<void> {
    return run(async () => {
      const result = await window.api.discardedMedia.trashFiles(ids)
      return result.success ? failedMessage(result.data.failed) : result.error.message
    })
  }

  async function trashAll(): Promise<void> {
    if (!items?.length) return
    const ok = await confirm({
      message: t('discarded.trashAllConfirm', { count: items.length }),
      confirmLabel: t('discarded.trashAll', { count: items.length }),
      danger: true
    })
    if (ok) await trash(items.map((item) => item.id))
  }

  function keep(id: string): Promise<void> {
    return run(async () => {
      const result = await window.api.discardedMedia.keepFile(id)
      return result.success ? null : result.error.message
    })
  }

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  return (
    <div className="manage-panel discarded-panel">
      <div className="discarded-header">
        <p className="discarded-intro">{t('discarded.intro')}</p>
        {items && items.length > 0 && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void trashAll()}
            disabled={busy}
            aria-busy={busy}
          >
            <Trash2 size={16} />
            <StableLabel
              current={
                busy ? t('discarded.working') : t('discarded.trashAll', { count: items.length })
              }
              labels={[t('discarded.trashAll', { count: items.length }), t('discarded.working')]}
            />
          </button>
        )}
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="manage-list-scroll">
        {items === null ? (
          <p className="loading-state">{t('gallery.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState icon={<Trash2 />} title={t('discarded.empty')} />
        ) : (
          <ul className="manage-list">
            {items.map((item) => {
              const { fileName, folder } = splitRoute(item.route)
              return (
                <li key={item.id} className="manage-list-item">
                  <EntityThumbnail route={item.route} loading={false} />
                  <div className="manage-item-info">
                    <span className="manage-item-name" title={item.route}>
                      {fileName}
                    </span>
                    <span className="discarded-item-meta">
                      {t(`discarded.reason.${item.reason}`, {
                        date: dateFormat.format(item.discardedAt)
                      })}
                      {folder && ` · ${folder}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void keep(item.id)}
                    disabled={busy}
                    aria-label={`${t('discarded.keep')}: ${fileName}`}
                    title={t('discarded.keepHint')}
                  >
                    {t('discarded.keep')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void trash([item.id])}
                    disabled={busy}
                    aria-label={`${t('discarded.trash')}: ${fileName}`}
                  >
                    <Trash2 size={16} />
                    {t('discarded.trash')}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
