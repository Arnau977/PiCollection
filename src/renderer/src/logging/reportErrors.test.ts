// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installErrorReporting } from './reportErrors'

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    value: { logging: { reportRendererError: vi.fn() } },
    writable: true,
    configurable: true
  })
  installErrorReporting()
})

describe('installErrorReporting', () => {
  it('reports an uncaught error with its message and stack', () => {
    const error = new Error('boom')
    window.dispatchEvent(new ErrorEvent('error', { message: error.message, error }))

    expect(window.api.logging.reportRendererError).toHaveBeenCalledWith('boom', error.stack)
  })

  it('reports an unhandled promise rejection whose reason is an Error', () => {
    const reason = new Error('rejected')
    const event = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(event, 'reason', { value: reason })

    window.dispatchEvent(event)

    expect(window.api.logging.reportRendererError).toHaveBeenCalledWith('rejected', reason.stack)
  })

  it('stringifies a non-Error rejection reason', () => {
    const event = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(event, 'reason', { value: 'plain string reason' })

    window.dispatchEvent(event)

    expect(window.api.logging.reportRendererError).toHaveBeenCalledWith(
      'plain string reason',
      undefined
    )
  })
})
