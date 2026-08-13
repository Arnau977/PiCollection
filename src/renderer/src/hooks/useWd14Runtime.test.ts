// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWd14Runtime } from './useWd14Runtime'

const getStatus = vi.fn()
const install = vi.fn()
const remove = vi.fn()
const onEvent = vi.fn()

beforeEach(() => {
  getStatus.mockReset().mockResolvedValue({ success: true, data: { state: 'not-installed' } })
  install.mockReset().mockResolvedValue({ success: true, data: undefined })
  remove.mockReset().mockResolvedValue({ success: true, data: undefined })
  onEvent.mockReset().mockReturnValue(() => {})
  Object.defineProperty(window, 'api', {
    value: { wd14Runtime: { getStatus, install, remove, onEvent } },
    writable: true,
    configurable: true
  })
})

describe('useWd14Runtime', () => {
  it('loads the initial status', async () => {
    getStatus.mockResolvedValue({ success: true, data: { state: 'installed' } })
    const { result } = renderHook(() => useWd14Runtime())

    await waitFor(() => expect(result.current.status).toBe('installed'))
  })

  it('subscribes to progress events and reflects them', async () => {
    let emit: (event: unknown) => void = () => {}
    onEvent.mockImplementation((listener) => {
      emit = listener
      return () => {}
    })
    const { result } = renderHook(() => useWd14Runtime())
    await waitFor(() => expect(result.current.status).toBe('not-installed'))

    act(() => emit({ type: 'progress', step: 'model', percent: 42 }))

    expect(result.current.status).toBe('installing')
    expect(result.current.percent).toBe(42)
    expect(result.current.step).toBe('model')
  })

  it('calls install() and reflects an "installed" event', async () => {
    let emit: (event: unknown) => void = () => {}
    onEvent.mockImplementation((listener) => {
      emit = listener
      return () => {}
    })
    const { result } = renderHook(() => useWd14Runtime())
    await waitFor(() => expect(result.current.status).toBe('not-installed'))

    act(() => result.current.install())
    expect(install).toHaveBeenCalled()

    act(() => emit({ type: 'installed' }))
    expect(result.current.status).toBe('installed')
  })

  it('reflects an error event with its message', async () => {
    let emit: (event: unknown) => void = () => {}
    onEvent.mockImplementation((listener) => {
      emit = listener
      return () => {}
    })
    const { result } = renderHook(() => useWd14Runtime())
    await waitFor(() => expect(result.current.status).toBe('not-installed'))

    act(() => emit({ type: 'error', message: 'Checksum mismatch' }))

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('Checksum mismatch')
  })

  it('calls remove() and resets to not-installed', async () => {
    getStatus.mockResolvedValue({ success: true, data: { state: 'installed' } })
    const { result } = renderHook(() => useWd14Runtime())
    await waitFor(() => expect(result.current.status).toBe('installed'))

    await act(() => result.current.remove())

    expect(remove).toHaveBeenCalled()
    expect(result.current.status).toBe('not-installed')
  })
})
