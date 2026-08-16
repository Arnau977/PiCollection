import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const readFile = vi.fn()
const writeFile = vi.fn()
const rename = vi.fn()
const ntExecutableFrom = vi.fn()
const ntExecutableResourceFrom = vi.fn()
const versionInfoFromEntries = vi.fn()
const logError = vi.fn()

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => readFile(...args),
  writeFile: (...args: unknown[]) => writeFile(...args),
  rename: (...args: unknown[]) => rename(...args)
}))
vi.mock('pe-library', () => ({
  NtExecutable: { from: (...args: unknown[]) => ntExecutableFrom(...args) },
  NtExecutableResource: { from: (...args: unknown[]) => ntExecutableResourceFrom(...args) }
}))
vi.mock('resedit', () => ({
  Resource: { VersionInfo: { fromEntries: (...args: unknown[]) => versionInfoFromEntries(...args) } }
}))
vi.mock('../../logging/logger', () => ({ logError: (...args: unknown[]) => logError(...args) }))

const { brandWindowsExecutable } = await import('./wd14Runtime.brand')

const originalPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform })
}

describe('brandWindowsExecutable', () => {
  beforeEach(() => {
    readFile.mockReset().mockResolvedValue(Buffer.from('fake-exe'))
    writeFile.mockReset().mockResolvedValue(undefined)
    rename.mockReset().mockResolvedValue(undefined)
    logError.mockReset()

    const generatedBytes = new Uint8Array([1, 2, 3])
    const fakeExe = { generate: () => generatedBytes }
    ntExecutableFrom.mockReset().mockReturnValue(fakeExe)

    const fakeRes = { entries: [], outputResource: vi.fn() }
    ntExecutableResourceFrom.mockReset().mockReturnValue(fakeRes)

    const fakeVersionInfo = { setStringValues: vi.fn(), outputToResourceEntries: vi.fn() }
    versionInfoFromEntries.mockReset().mockReturnValue([fakeVersionInfo])
  })

  afterEach(() => {
    setPlatform(originalPlatform)
  })

  it('does nothing on non-Windows platforms', async () => {
    setPlatform('darwin')

    await brandWindowsExecutable('/path/to/python')

    expect(readFile).not.toHaveBeenCalled()
  })

  it('parses, rewrites version info, and swaps the file in via a temp file + rename', async () => {
    setPlatform('win32')

    await brandWindowsExecutable('C:\\python\\python.exe')

    expect(readFile).toHaveBeenCalledWith('C:\\python\\python.exe')
    expect(versionInfoFromEntries).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalledWith(
      'C:\\python\\python.exe.branding-tmp',
      Buffer.from([1, 2, 3])
    )
    expect(rename).toHaveBeenCalledWith(
      'C:\\python\\python.exe.branding-tmp',
      'C:\\python\\python.exe'
    )
  })

  it('logs and swallows a failure instead of throwing', async () => {
    setPlatform('win32')
    readFile.mockRejectedValue(new Error('boom'))

    await expect(brandWindowsExecutable('C:\\python\\python.exe')).resolves.toBeUndefined()
    expect(logError).toHaveBeenCalledWith(
      'wd14Runtime',
      'Failed to rebrand python.exe version info',
      expect.any(Error)
    )
    expect(writeFile).not.toHaveBeenCalled()
  })
})
