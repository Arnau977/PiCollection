import { describe, expect, it, vi, beforeEach } from 'vitest'
import { IPC } from '@shared/ipc/contracts'
import {
  notifyEntitiesChanged,
  setEntityEventsWindow,
  __resetEntityEventsWindowForTests
} from './entityEvents'

function fakeWindow(destroyed = false): {
  isDestroyed: () => boolean
  webContents: { send: ReturnType<typeof vi.fn> }
} {
  return { isDestroyed: () => destroyed, webContents: { send: vi.fn() } }
}

beforeEach(() => __resetEntityEventsWindowForTests())

describe('notifyEntitiesChanged', () => {
  it('sends the kinds payload over the entities:changed channel', () => {
    const window = fakeWindow()
    setEntityEventsWindow(window as never)

    notifyEntitiesChanged(['tag', 'series'])

    expect(window.webContents.send).toHaveBeenCalledWith(IPC.entities.changed, {
      kinds: ['tag', 'series', 'filterList']
    })
  })

  it('sends a filter list change on its own without repeating it', () => {
    const window = fakeWindow()
    setEntityEventsWindow(window as never)

    notifyEntitiesChanged(['filterList'])

    expect(window.webContents.send).toHaveBeenCalledWith(IPC.entities.changed, {
      kinds: ['filterList']
    })
  })

  it('does nothing when no window has been set', () => {
    expect(() => notifyEntitiesChanged(['tag'])).not.toThrow()
  })

  it('does nothing when the window has been destroyed', () => {
    const window = fakeWindow(true)
    setEntityEventsWindow(window as never)

    notifyEntitiesChanged(['tag'])

    expect(window.webContents.send).not.toHaveBeenCalled()
  })

  it('does nothing for an empty kinds list', () => {
    const window = fakeWindow()
    setEntityEventsWindow(window as never)

    notifyEntitiesChanged([])

    expect(window.webContents.send).not.toHaveBeenCalled()
  })
})
