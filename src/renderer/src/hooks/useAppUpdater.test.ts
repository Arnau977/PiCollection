// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAppUpdater } from './useAppUpdater'

function setApi(overrides: {
  getChannel?: ReturnType<typeof vi.fn>
  setChannel?: ReturnType<typeof vi.fn>
  checkForUpdates?: ReturnType<typeof vi.fn>
  downloadUpdate?: ReturnType<typeof vi.fn>
  quitAndInstall?: ReturnType<typeof vi.fn>
  onEvent?: ReturnType<typeof vi.fn>
  getAppVersion?: ReturnType<typeof vi.fn>
  getStatus?: ReturnType<typeof vi.fn>
}): void {
  Object.defineProperty(window, 'api', {
    value: {
      system: {
        getAppVersion:
          overrides.getAppVersion ??
          vi.fn().mockResolvedValue({
            success: true,
            data: '1.0.0'
          })
      },
      updater: {
        getChannel:
          overrides.getChannel ??
          vi.fn().mockResolvedValue({
            success: true,
            data: 'stable'
          }),
        setChannel:
          overrides.setChannel ?? vi.fn().mockResolvedValue({ success: true, data: undefined }),
        checkForUpdates:
          overrides.checkForUpdates ??
          vi.fn().mockResolvedValue({ success: true, data: undefined }),
        downloadUpdate:
          overrides.downloadUpdate ?? vi.fn().mockResolvedValue({ success: true, data: undefined }),
        quitAndInstall:
          overrides.quitAndInstall ?? vi.fn().mockResolvedValue({ success: true, data: undefined }),
        onEvent: overrides.onEvent ?? vi.fn().mockReturnValue(() => {}),
        getStatus: overrides.getStatus ?? vi.fn().mockResolvedValue({ success: true, data: null })
      }
    },
    writable: true,
    configurable: true
  })
}

describe('useAppUpdater', () => {
  beforeEach(() => {
    setApi({})
  })

  it('loads the current channel and app version on mount', async () => {
    const { result } = renderHook(() => useAppUpdater())

    await waitFor(() => expect(result.current.appVersion).toBe('1.0.0'))
    expect(result.current.channel).toBe('stable')
    expect(result.current.status).toEqual({ state: 'idle' })
  })

  it('subscribes to updater events and reflects them in status', async () => {
    let emit: (event: unknown) => void = () => {}
    const onEvent = vi.fn((listener: (event: unknown) => void) => {
      emit = listener
      return () => {}
    })
    setApi({ onEvent })

    const { result } = renderHook(() => useAppUpdater())

    act(() => emit({ type: 'available', version: '2.0.0', highlights: '- New thing' }))

    expect(result.current.status).toEqual({
      state: 'available',
      version: '2.0.0',
      highlights: '- New thing'
    })
  })

  it('hydrates status from the last known event on mount, not just idle', async () => {
    const getStatus = vi.fn().mockResolvedValue({
      success: true,
      data: { type: 'available', version: '2.0.0', highlights: null }
    })
    setApi({ getStatus })

    const { result } = renderHook(() => useAppUpdater())

    await waitFor(() =>
      expect(result.current.status).toEqual({
        state: 'available',
        version: '2.0.0',
        highlights: null
      })
    )
  })

  it('unsubscribes from updater events on unmount', () => {
    const unsubscribe = vi.fn()
    const onEvent = vi.fn().mockReturnValue(unsubscribe)
    setApi({ onEvent })

    const { unmount } = renderHook(() => useAppUpdater())
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('checkForUpdates surfaces a failed IPC result as an error status', async () => {
    const checkForUpdates = vi
      .fn()
      .mockResolvedValue({ success: false, error: { code: 'INTERNAL', message: 'boom' } })
    setApi({ checkForUpdates })

    const { result } = renderHook(() => useAppUpdater())

    await act(async () => {
      await result.current.checkForUpdates()
    })

    expect(result.current.status).toEqual({ state: 'error', message: 'boom' })
  })

  it('setChannel only updates local state when the IPC call succeeds', async () => {
    const setChannel = vi
      .fn()
      .mockResolvedValue({ success: false, error: { code: 'X', message: 'no' } })
    setApi({ setChannel })

    const { result } = renderHook(() => useAppUpdater())

    await act(async () => {
      await result.current.setChannel('beta')
    })

    expect(result.current.channel).toBe('stable')
  })
})
