// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SHORTCUTS, useShortcut } from '../../hooks/useShortcut'
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

describe('Lightbox click outside', () => {
  it('ignores the click that ends a pan, but closes on the next one after zooming back out', async () => {
    Object.assign(HTMLElement.prototype, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => false)
    })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Lightbox src="app://pic.png" type="image" alt="Pic" route="pic.png" onClose={onClose} />
    )
    const image = screen.getByRole('img', { name: 'Pic' })
    const backdrop = screen.getByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Zoom in (+)' }))
    fireEvent.pointerDown(image, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(image, { pointerId: 1, clientX: 160, clientY: 140 })
    fireEvent.pointerUp(image, { pointerId: 1, clientX: 160, clientY: 140 })
    fireEvent.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('0')
    fireEvent.pointerDown(backdrop, { button: 0 })
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })
})

describe('Lightbox Esc', () => {
  // The batch import's Esc opened its exit dialog while a picture was open.
  it('closes itself without triggering the page behind it', async () => {
    const onClose = vi.fn()
    const leavePage = vi.fn()
    function Page(): JSX.Element {
      useShortcut(SHORTCUTS.leaveEdit, leavePage)
      return (
        <Lightbox src="app://pic.png" type="image" alt="Pic" route="pic.png" onClose={onClose} />
      )
    }
    render(<Page />)

    await userEvent.setup().keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
    expect(leavePage).not.toHaveBeenCalled()
  })
})
