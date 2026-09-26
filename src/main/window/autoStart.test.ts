import { beforeEach, describe, expect, it, vi } from 'vitest'

const app = vi.hoisted(() => ({
  isPackaged: true,
  getLoginItemSettings: vi.fn(),
  setLoginItemSettings: vi.fn()
}))

vi.mock('electron', () => ({ app }))

const { getAutoStartStatus, setAutoStart, isHiddenLaunch } = await import('./autoStart')

beforeEach(() => {
  app.isPackaged = true
  app.getLoginItemSettings.mockReset().mockReturnValue({ openAtLogin: false })
  app.setLoginItemSettings.mockReset()
})

describe('autoStart', () => {
  it.skipIf(process.platform === 'linux')(
    'registers and queries the login item with the hidden-launch arg',
    () => {
      app.getLoginItemSettings.mockReturnValue({ openAtLogin: true })

      expect(setAutoStart(true)).toEqual({ supported: true, enabled: true })
      expect(app.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        args: ['--hidden']
      })
      expect(app.getLoginItemSettings).toHaveBeenCalledWith({ args: ['--hidden'] })
    }
  )

  it('is unsupported in an unpackaged build and refuses to register', () => {
    app.isPackaged = false

    expect(getAutoStartStatus()).toEqual({ supported: false, enabled: false })
    expect(() => setAutoStart(true)).toThrow()
    expect(app.setLoginItemSettings).not.toHaveBeenCalled()
  })

  it('detects a hidden launch from argv', () => {
    expect(isHiddenLaunch(['PiCollection.exe', '--hidden'])).toBe(true)
    expect(isHiddenLaunch(['PiCollection.exe'])).toBe(false)
  })
})
