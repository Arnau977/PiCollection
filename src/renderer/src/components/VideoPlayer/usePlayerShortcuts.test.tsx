// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { usePlayerShortcuts, type PlayerAction } from './usePlayerShortcuts'

function Player({ actions }: { actions: Partial<Record<PlayerAction, () => void>> }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  usePlayerShortcuts(ref, actions)
  return <div ref={ref} />
}

describe('usePlayerShortcuts', () => {
  it('only the player in front reacts', () => {
    const pageLoop = vi.fn()
    const modalLoop = vi.fn()
    const { rerender } = render(
      <>
        <Player actions={{ loop: pageLoop }} />
        <div aria-modal="true">
          <Player actions={{ loop: modalLoop }} />
        </div>
      </>
    )

    fireEvent.keyDown(document.body, { key: 'l' })
    expect(modalLoop).toHaveBeenCalledTimes(1)
    expect(pageLoop).not.toHaveBeenCalled()

    rerender(<Player actions={{ loop: pageLoop }} />)
    fireEvent.keyDown(document.body, { key: 'l' })
    expect(pageLoop).toHaveBeenCalledTimes(1)
  })

  it('does nothing while typing in a field', () => {
    const loop = vi.fn()
    const { container } = render(
      <>
        <Player actions={{ loop }} />
        <input />
      </>
    )
    const input = container.querySelector('input')!
    input.focus()

    fireEvent.keyDown(input, { key: 'l' })
    expect(loop).not.toHaveBeenCalled()
  })

  it('arrows on a slider are left to it', () => {
    const forward = vi.fn()
    const { container } = render(
      <>
        <Player actions={{ forward }} />
        <div role="slider" tabIndex={0} aria-valuenow={0} />
      </>
    )
    const slider = container.querySelector<HTMLElement>('[role="slider"]')!
    slider.focus()

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(forward).not.toHaveBeenCalled()
  })

  it('Space toggles play without scrolling the page', () => {
    const togglePlay = vi.fn()
    render(<Player actions={{ togglePlay }} />)

    const notCancelled = fireEvent.keyDown(document.body, { key: ' ' })
    expect(togglePlay).toHaveBeenCalledTimes(1)
    expect(notCancelled).toBe(false)
  })

  it('tells Shift+L (clear section) apart from L (loop)', () => {
    const loop = vi.fn()
    const clearSection = vi.fn()
    render(<Player actions={{ loop, clearSection }} />)

    fireEvent.keyDown(document.body, { key: 'L', shiftKey: true })
    expect(clearSection).toHaveBeenCalledTimes(1)
    expect(loop).not.toHaveBeenCalled()
  })
})

describe('usePlayerShortcuts arrows', () => {
  it('seeks only while the pointer is over or focus is inside the player, and then claims the key', () => {
    const forward = vi.fn()
    const { container } = render(<Player actions={{ forward }} />)
    const player = container.firstElementChild as HTMLElement

    // Not engaged: left to the page (the media page uses arrows for previous/next).
    const pageKey = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true
    })
    document.body.dispatchEvent(pageKey)
    expect(forward).not.toHaveBeenCalled()
    expect(pageKey.defaultPrevented).toBe(false)

    fireEvent.pointerEnter(player)
    const playerKey = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true
    })
    document.body.dispatchEvent(playerKey)
    expect(forward).toHaveBeenCalledTimes(1)
    expect(playerKey.defaultPrevented).toBe(true)
  })
})
