// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaFileActions } from './MediaFileActions'
import { copyImageViaCanvas } from './copyImageViaCanvas'

vi.mock('./copyImageViaCanvas', () => ({ copyImageViaCanvas: vi.fn().mockResolvedValue(true) }))

describe('MediaFileActions copy image', () => {
  // Electron's nativeImage can't read WebP (animated or not); Chromium can.
  it('falls back to a canvas copy when the main process cannot read the file', async () => {
    Object.defineProperty(window, 'api', {
      value: {
        system: {
          copyImageToClipboard: vi.fn().mockResolvedValue({
            success: false,
            error: { code: 'INTERNAL', message: 'Could not read image data from that file.' }
          })
        }
      },
      configurable: true
    })
    const user = userEvent.setup()
    render(<MediaFileActions route="C:/pics/anim.webp" type="image" />)

    await user.click(screen.getByRole('button', { name: 'Copy image' }))

    expect(copyImageViaCanvas).toHaveBeenCalledWith(expect.stringContaining('anim.webp'))
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })
})
