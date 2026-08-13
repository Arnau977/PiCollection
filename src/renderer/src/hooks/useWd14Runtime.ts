import { useCallback, useEffect, useState } from 'react'

type Status = 'not-installed' | 'installing' | 'installed' | 'error'
type Step = 'python' | 'packages' | 'model'

interface UseWd14RuntimeResult {
  status: Status
  percent: number
  step: Step | null
  errorMessage: string | null
  install: () => void
  remove: () => Promise<void>
}

export function useWd14Runtime(): UseWd14RuntimeResult {
  const [status, setStatus] = useState<Status>('not-installed')
  const [percent, setPercent] = useState(0)
  const [step, setStep] = useState<Step | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    window.api.wd14Runtime.getStatus().then((result) => {
      if (result.success) setStatus(result.data.state)
    })
  }, [])

  useEffect(
    () =>
      window.api.wd14Runtime.onEvent((event) => {
        if (event.type === 'progress') {
          setStatus('installing')
          setPercent(event.percent)
          setStep(event.step)
        } else if (event.type === 'installed') {
          setStatus('installed')
          setPercent(100)
        } else {
          setStatus('error')
          setErrorMessage(event.message)
        }
      }),
    []
  )

  const install = useCallback(() => {
    setStatus('installing')
    setPercent(0)
    setErrorMessage(null)
    window.api.wd14Runtime.install()
  }, [])

  const remove = useCallback(async () => {
    await window.api.wd14Runtime.remove()
    setStatus('not-installed')
    setPercent(0)
  }, [])

  return { status, percent, step, errorMessage, install, remove }
}
