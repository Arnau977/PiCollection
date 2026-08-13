import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PATH } from '../../app.routes.const'

type State = { kind: 'loading' } | { kind: 'redirect'; id: string } | { kind: 'empty' }

export default function PendingEntryPage(): JSX.Element {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    window.api.media
      .getOrderedIds({ pendingTagging: true }, { prop: 'createdAt', desc: false })
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data.length > 0) {
          setState({ kind: 'redirect', id: result.data[0] })
        } else {
          setState({ kind: 'empty' })
        }
      })
    return (): void => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') {
    return (
      <div className="page">
        <p className="loading-state">{t('gallery.loading')}</p>
      </div>
    )
  }

  if (state.kind === 'redirect') {
    return <Navigate to={PATH.MEDIA.replace(':id', state.id)} state={{ pendingQueue: true }} replace />
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('pending.allCaughtUp')}</h1>
      <p>{t('pending.allCaughtUpHint')}</p>
    </div>
  )
}
