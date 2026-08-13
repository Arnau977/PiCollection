import { afterEach, describe, expect, it } from 'vitest'
import { getModelAssets, getPlatformAssets } from './wd14Runtime.assets'

const originalPlatform = process.platform
const originalArch = process.arch

function setPlatform(platform: string, arch: string): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
  Object.defineProperty(process, 'arch', { value: arch, configurable: true })
}

afterEach(() => {
  setPlatform(originalPlatform, originalArch)
})

describe('getPlatformAssets', () => {
  it('returns pinned assets for win32-x64', () => {
    setPlatform('win32', 'x64')
    const assets = getPlatformAssets()
    expect(assets?.python.sha256).toBe(
      '6cf2be701aa7e9470454c9c86285c1bcc1832518d63e39c3e34e9d8ea1cbb99f'
    )
    expect(assets?.python.url).toContain('x86_64-pc-windows-msvc-install_only.tar.gz')
    expect(assets?.onnxruntime.url).toContain('win_amd64.whl')
  })

  it('returns pinned assets for darwin-arm64', () => {
    setPlatform('darwin', 'arm64')
    const assets = getPlatformAssets()
    expect(assets?.python.url).toContain('aarch64-apple-darwin-install_only.tar.gz')
    expect(assets?.onnxruntime.url).toContain('universal2')
  })

  it('returns pinned assets for darwin-x64, sharing the universal2 onnxruntime wheel with arm64', () => {
    setPlatform('darwin', 'x64')
    const assets = getPlatformAssets()
    expect(assets?.python.url).toContain('x86_64-apple-darwin-install_only.tar.gz')
    expect(assets?.onnxruntime.sha256).toBe(
      'f3c0380f53c1e72a41b3f4d6af2ccc01df2c17844072233442c3a7e74851ab97'
    )
  })

  it('returns pinned assets for linux-x64', () => {
    setPlatform('linux', 'x64')
    const assets = getPlatformAssets()
    expect(assets?.python.url).toContain('x86_64-unknown-linux-gnu-install_only.tar.gz')
  })

  it('returns null for an unpinned platform/arch combination', () => {
    setPlatform('win32', 'arm64')
    expect(getPlatformAssets()).toBeNull()
  })
})

describe('getModelAssets', () => {
  it('returns the pinned WD14 model and tags file', () => {
    const assets = getModelAssets()
    expect(assets.model.sha256).toBe(
      '35f23693620b668f4d53fd3c62bf65e40af739bc52c7eb0fbc49258b58d065b6'
    )
    expect(assets.model.size).toBe(378536310)
    expect(assets.tags.sha256).toBe(
      '298633d94d0031d2081c0893f29c82eab7f0df00b08483ba8f29d1e979441217'
    )
  })
})
