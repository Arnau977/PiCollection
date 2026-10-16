// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { usePlayerShortcuts, type PlayerAction } from './usePlayerShortcuts'

function Player({ actions }: { actions: Partial<Record<PlayerAction, () => void>> }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  usePlayerShortcuts(ref, actions)
  return (
    <div ref={ref} data-testid="player">
      <button type="button">pill button</button>
    </div>
  )
}

function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

/** Focus as a keyboard user would (Tab), or as a mouse click does. */
function focusWith(element: HTMLElement, how: 'keyboard' | 'pointer'): void {
  if (how === 'keyboard') press(document.body, 'Tab')
  else fireEvent.pointerDown(element)
  element.focus()
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

    press(document.body, 'l')
    expect(modalLoop).toHaveBeenCalledTimes(1)
    expect(pageLoop).not.toHaveBeenCalled()

    rerender(<Player actions={{ loop: pageLoop }} />)
    press(document.body, 'l')
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

    press(input, 'l')
    expect(loop).not.toHaveBeenCalled()
  })

  it('Space toggles play without scrolling the page when nothing is focused', () => {
    const togglePlay = vi.fn()
    render(<Player actions={{ togglePlay }} />)

    const event = press(document.body, ' ')
    expect(togglePlay).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves Space and letters to a focused control outside the player', () => {
    const togglePlay = vi.fn()
    const loop = vi.fn()
    const { getByText } = render(
      <>
        <Player actions={{ togglePlay, loop }} />
        <button type="button">Edit</button>
      </>
    )
    const outside = getByText('Edit')
    focusWith(outside, 'keyboard')

    const space = press(outside, ' ')
    press(outside, 'l')
    expect(togglePlay).not.toHaveBeenCalled()
    expect(loop).not.toHaveBeenCalled()
    expect(space.defaultPrevented).toBe(false)
  })

  it('lets Space press a focused pill button itself', () => {
    const togglePlay = vi.fn()
    const { getByText } = render(<Player actions={{ togglePlay }} />)
    const pillButton = getByText('pill button')
    focusWith(pillButton, 'keyboard')

    const space = press(pillButton, ' ')
    expect(togglePlay).not.toHaveBeenCalled()
    expect(space.defaultPrevented).toBe(false)
  })

  it('tells Shift+L (clear section) apart from L (loop)', () => {
    const loop = vi.fn()
    const clearSection = vi.fn()
    render(<Player actions={{ loop, clearSection }} />)

    press(document.body, 'L', { shiftKey: true })
    expect(clearSection).toHaveBeenCalledTimes(1)
    expect(loop).not.toHaveBeenCalled()
  })
})

describe('usePlayerShortcuts arrows', () => {
  it('are left to the page, even with the pointer resting over the player', () => {
    const forward = vi.fn()
    const { getByTestId } = render(<Player actions={{ forward }} />)
    fireEvent.pointerEnter(getByTestId('player'))

    const event = press(document.body, 'ArrowRight')
    expect(forward).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('seek once keyboard focus is inside the player, and claim the key', () => {
    const forward = vi.fn()
    const { getByText } = render(<Player actions={{ forward }} />)
    const pillButton = getByText('pill button')
    focusWith(pillButton, 'keyboard')

    const event = press(pillButton, 'ArrowRight')
    expect(forward).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('stay with the page after a mouse click left focus on a pill button', () => {
    const forward = vi.fn()
    const { getByText } = render(<Player actions={{ forward }} />)
    const pillButton = getByText('pill button')
    focusWith(pillButton, 'pointer')

    press(pillButton, 'ArrowRight')
    expect(forward).not.toHaveBeenCalled()
  })
})

describe('usePlayerShortcuts held keys', () => {
  it('claims held-down repeats of ← / → and Space without acting on them again', () => {
    const forward = vi.fn()
    const togglePlay = vi.fn()
    const { getByText } = render(<Player actions={{ forward, togglePlay }} />)
    const pillButton = getByText('pill button')
    focusWith(pillButton, 'keyboard')

    press(pillButton, 'ArrowRight')
    const repeat = press(pillButton, 'ArrowRight', { repeat: true })
    expect(forward).toHaveBeenCalledTimes(1)
    expect(repeat.defaultPrevented).toBe(true)

    pillButton.blur()
    press(document.body, ' ')
    const spaceRepeat = press(document.body, ' ', { repeat: true })
    expect(togglePlay).toHaveBeenCalledTimes(1)
    expect(spaceRepeat.defaultPrevented).toBe(true)
  })
})
