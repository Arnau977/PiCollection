// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VideoPlayer } from './VideoPlayer'
import { loadVideoPlayerPrefs } from './videoPlayerPrefs'

function video(): HTMLVideoElement {
  return document.querySelector('video')!
}

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement
  ) {
    Object.defineProperty(this, 'paused', { configurable: true, value: false })
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement
  ) {
    Object.defineProperty(this, 'paused', { configurable: true, value: true })
    this.dispatchEvent(new Event('pause'))
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('VideoPlayer', () => {
  it('renders the pill with every control, named for screen readers', () => {
    render(<VideoPlayer src="app://x.mp4" />)

    for (const name of [
      'Play',
      'Back 5 seconds',
      'Forward 5 seconds',
      'Loop',
      'Speed',
      'Mute',
      'Full screen'
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    }
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeInTheDocument()
    expect(video()).not.toHaveAttribute('controls')
  })

  it('shows 0:00 until the duration is known', () => {
    render(<VideoPlayer src="app://x.mp4" />)
    Object.defineProperty(video(), 'duration', { configurable: true, value: Number.NaN })
    act(() => {
      video().dispatchEvent(new Event('loadedmetadata'))
    })

    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('NaN')
  })

  it('toggles loop and remembers it', async () => {
    render(<VideoPlayer src="app://x.mp4" />)

    await userEvent.click(screen.getByRole('button', { name: /^Loop/ }))

    expect(screen.getByRole('button', { name: /^Loop/ })).toHaveAttribute('aria-pressed', 'true')
    expect(video().loop).toBe(true)
    expect(loadVideoPlayerPrefs().loop).toBe(true)
  })

  it('picks a speed from the menu', async () => {
    render(<VideoPlayer src="app://x.mp4" />)

    await userEvent.click(screen.getByRole('button', { name: /^Speed/ }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: '1.5×' }))

    expect(video().playbackRate).toBe(1.5)
  })

  it('hides 2 s after a mouse click on a pill button, even though the button keeps focus', () => {
    vi.useFakeTimers()
    const { container } = render(<VideoPlayer src="app://x.mp4" />)
    const root = container.firstElementChild as HTMLElement
    const play = screen.getByRole('button', { name: /^Play/ })

    fireEvent.pointerDown(play)
    act(() => play.focus())
    fireEvent.click(play)
    fireEvent.pointerMove(root)
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(root).toHaveAttribute('data-controls-visible', 'false')
  })

  it('stays visible while focus is inside, and hides after 2 s of playing otherwise', () => {
    vi.useFakeTimers()
    const { container } = render(<VideoPlayer src="app://x.mp4" />)
    const root = container.firstElementChild as HTMLElement
    act(() => {
      void video().play()
    })

    // Keyboard focus (Tab), not a mouse click: only that keeps the pill up.
    fireEvent.keyDown(document.body, { key: 'Tab' })
    act(() => screen.getByRole('button', { name: /^Pause/ }).focus())
    fireEvent.pointerMove(root)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(root).toHaveAttribute('data-controls-visible', 'true')

    act(() => (document.activeElement as HTMLElement).blur())
    fireEvent.pointerMove(root)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(root).toHaveAttribute('data-controls-visible', 'false')
  })
})
