// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lightbox } from './Lightbox'

vi.mock('../MediaFileActions/MediaFileActions', () => ({ MediaFileActions: () => null }))

function renderLightbox(type: 'image' | 'video' = 'image'): void {
  render(<Lightbox src="app://pic.png" type={type} alt="Pic" route="pic.png" onClose={vi.fn()} />)
}

describe('Lightbox zoom', () => {
  it('zooms with the buttons and the keyboard, and resets to fit', async () => {
    const user = userEvent.setup()
    renderLightbox()
    const zoomOut = screen.getByRole('button', { name: 'Zoom out (-)' })
    expect(zoomOut).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Zoom in (+)' }))
    expect(screen.getByRole('button', { name: /^Zoom 125%/ })).toBeInTheDocument()
    expect(zoomOut).toBeEnabled()

    await user.keyboard('+')
    expect(screen.getByRole('button', { name: /^Zoom 156%/ })).toBeInTheDocument()

    await user.keyboard('0')
    expect(screen.getByRole('button', { name: /^Zoom 100%/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pic' }).style.transform).toBe(
      'translate(0px, 0px) scale(1)'
    )
  })

  it('offers no zoom for a video', () => {
    renderLightbox('video')
    expect(screen.queryByRole('button', { name: 'Zoom in (+)' })).not.toBeInTheDocument()
  })
})
