// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
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

    await userEvent.click(screen.getByRole('button', { name: 'Loop' }))

    expect(screen.getByRole('button', { name: 'Loop' })).toHaveAttribute('aria-pressed', 'true')
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

  it('opens the speed menu inside the player, so it still shows in full screen', async () => {
    const { container } = render(<VideoPlayer src="app://x.mp4" />)
    const root = container.firstElementChild as HTMLElement

    await userEvent.click(screen.getByRole('button', { name: /^Speed/ }))

    // In full screen only the fullscreen element's subtree is painted: a menu
    // portaled to <body> exists but can't be seen.
    expect(root).toContainElement(screen.getByRole('menu'))
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

describe('VideoPlayer section, frames and volume keys', () => {
  function at(time: number): void {
    act(() => {
      video().currentTime = time
      video().dispatchEvent(new Event('timeupdate'))
    })
  }

  function key(k: string, init: KeyboardEventInit = {}): void {
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })
      )
    })
  }

  function withDuration(seconds: number): void {
    Object.defineProperty(video(), 'duration', { configurable: true, value: seconds })
    act(() => {
      video().dispatchEvent(new Event('loadedmetadata'))
    })
  }

  it('sets the section with [ and ] and clears it with Shift+L', () => {
    render(<VideoPlayer src="app://x.mp4" />)
    withDuration(10)
    expect(screen.getByRole('button', { name: /^Loop section/ })).toBeInTheDocument()

    at(2)
    key('[')
    at(4)
    key(']')
    expect(screen.getByRole('button', { name: /^Clear section/ })).toBeInTheDocument()

    key('L', { shiftKey: true })
    expect(screen.getByRole('button', { name: /^Loop section/ })).toBeInTheDocument()
  })

  it('loops between A and B', () => {
    render(<VideoPlayer src="app://x.mp4" />)
    withDuration(10)
    at(2)
    key('[')
    at(4)
    key(']')
    act(() => {
      void video().play()
    })

    at(4.01)
    expect(video().currentTime).toBe(2)
  })

  it('steps one frame while paused only', () => {
    render(<VideoPlayer src="app://x.mp4" />)
    withDuration(10)
    at(1)

    key('.')
    expect(video().currentTime).toBeCloseTo(1 + 1 / 30, 3)

    act(() => {
      void video().play()
    })
    const before = video().currentTime
    key('.')
    expect(video().currentTime).toBe(before)
  })

  it('↑ raises the volume 1% with keyboard focus inside, and shows it', () => {
    window.localStorage.setItem(
      'picollection:video-player',
      JSON.stringify({ loop: false, volume: 0.5, muted: false })
    )
    render(<VideoPlayer src="app://x.mp4" />)
    fireEvent.keyDown(document.body, { key: 'Tab' })
    act(() => screen.getByRole('button', { name: /^Play/ }).focus())

    key('ArrowUp')

    expect(video().volume).toBeCloseTo(0.51)
    expect(screen.getByText('Volume 51%')).toBeInTheDocument()
  })

  it('arrows go to the player in full screen even with nothing focused', () => {
    const { container } = render(<VideoPlayer src="app://x.mp4" />)
    withDuration(20)
    at(3)
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => container.firstElementChild
    })

    key('ArrowRight')

    expect(video().currentTime).toBe(8)
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null })
  })
})

describe('VideoPlayer section edge cases', () => {
  function at(time: number): void {
    act(() => {
      video().currentTime = time
      video().dispatchEvent(new Event('timeupdate'))
    })
  }
  function key(k: string, init: KeyboardEventInit = {}): void {
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })
      )
    })
  }
  function withDuration(seconds: number): void {
    Object.defineProperty(video(), 'duration', { configurable: true, value: seconds })
    act(() => {
      video().dispatchEvent(new Event('loadedmetadata'))
    })
  }
  function markSection(start: number, end: number): void {
    at(start)
    key('[')
    at(end)
    key(']')
  }

  it('lets you seek outside the section while paused', () => {
    render(<VideoPlayer src="app://x.mp4" />)
    withDuration(10)
    markSection(2, 4)

    at(7)
    expect(video().currentTime).toBe(7)
  })

  it('keeps looping a section that ends at the end of the video', () => {
    render(<VideoPlayer src="app://x.mp4" />)
    withDuration(10)
    markSection(6, 10)
    act(() => {
      void video().play()
    })
    const play = vi.mocked(HTMLMediaElement.prototype.play)
    play.mockClear()

    act(() => {
      video().dispatchEvent(new Event('ended'))
    })
    expect(video().currentTime).toBe(6)
    expect(play).toHaveBeenCalled()
  })

  it('clears the section when the video changes', () => {
    const { rerender } = render(<VideoPlayer src="app://one.mp4" />)
    withDuration(10)
    markSection(2, 4)
    expect(screen.getByRole('button', { name: /^Clear section/ })).toBeInTheDocument()

    rerender(<VideoPlayer src="app://two.mp4" />)
    expect(screen.getByRole('button', { name: /^Loop section/ })).toBeInTheDocument()
  })

  it('names the section button for what it does next, without a pressed state', () => {
    render(<VideoPlayer src="app://x.mp4" />)
    withDuration(10)
    at(2)
    key('[')

    const button = screen.getByRole('button', { name: /^Set section end/ })
    expect(button).not.toHaveAttribute('aria-pressed')
  })

  it('steps from the kept level when muted: ↓ stays muted, ↑ unmutes one step up', () => {
    window.localStorage.setItem(
      'picollection:video-player',
      JSON.stringify({ loop: false, volume: 0.6, muted: true })
    )
    render(<VideoPlayer src="app://x.mp4" />)
    fireEvent.keyDown(document.body, { key: 'Tab' })
    act(() => screen.getByRole('button', { name: /^Play/ }).focus())

    key('ArrowDown')
    expect(video().muted).toBe(true)
    expect(video().volume).toBeCloseTo(0.6)

    key('ArrowUp')
    expect(video().muted).toBe(false)
    expect(video().volume).toBeCloseTo(0.61)
  })

  it('folds speed and the actions into a More menu in compact mode, in separate sections', async () => {
    render(<VideoPlayer src="app://x.mp4" compact />)

    expect(screen.queryByRole('button', { name: /^Speed/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Loop section/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('menuitemradio', { name: '1.5×' })).toBeInTheDocument()
    const [speed, actions] = screen.getAllByRole('group')
    expect(within(speed).getByText('Speed')).toBeInTheDocument()
    expect(within(speed).queryByRole('menuitem', { name: 'Loop section' })).not.toBeInTheDocument()
    expect(within(actions).getByRole('menuitem', { name: 'Loop section' })).toBeInTheDocument()
    expect(within(actions).getByRole('menuitem', { name: 'Copy frame' })).toBeInTheDocument()
  })
})

describe('VideoPlayer volume hover', () => {
  it('shows the volume level while the pointer is over the volume control', () => {
    window.localStorage.setItem(
      'picollection:video-player',
      JSON.stringify({ loop: false, volume: 0.65, muted: false })
    )
    render(<VideoPlayer src="app://x.mp4" />)
    expect(screen.queryByText('65%')).not.toBeInTheDocument()

    fireEvent.pointerEnter(
      screen.getByRole('slider', { name: 'Volume' }).closest('.video-volume-group')!
    )
    expect(screen.getByText('65%')).toBeInTheDocument()

    fireEvent.pointerLeave(
      screen.getByRole('slider', { name: 'Volume' }).closest('.video-volume-group')!
    )
    expect(screen.queryByText('65%')).not.toBeInTheDocument()
  })
})

describe('VideoPlayer range mode (Make GIF)', () => {
  it('moves the clip ends with [ and ] through onChange, without a section button', () => {
    const onChange = vi.fn()
    render(<VideoPlayer src="app://x.mp4" rangeMode={{ value: { start: 2, end: 8 }, onChange }} />)
    Object.defineProperty(video(), 'duration', { configurable: true, value: 20 })
    act(() => {
      video().dispatchEvent(new Event('loadedmetadata'))
    })
    expect(screen.queryByRole('button', { name: /section/i })).not.toBeInTheDocument()

    act(() => {
      video().currentTime = 5
      video().dispatchEvent(new Event('timeupdate'))
    })
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: ']', bubbles: true, cancelable: true })
      )
    })
    expect(onChange).toHaveBeenLastCalledWith({ start: 2, end: 5 })

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: '[', bubbles: true, cancelable: true })
      )
    })
    expect(onChange).toHaveBeenLastCalledWith({ start: 5, end: 8 })
  })
})

describe('VideoPlayer volume steps', () => {
  it('keeps changing the volume while ↑ is held down, 1% per step', () => {
    window.localStorage.setItem(
      'picollection:video-player',
      JSON.stringify({ loop: false, volume: 0.5, muted: false })
    )
    render(<VideoPlayer src="app://x.mp4" />)
    fireEvent.keyDown(document.body, { key: 'Tab' })
    act(() => screen.getByRole('button', { name: /^Play/ }).focus())

    for (const repeat of [false, true, true, true]) {
      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowUp', repeat, bubbles: true, cancelable: true })
        )
      })
    }

    expect(video().volume).toBeCloseTo(0.54)
  })

  it('moves the volume slider in 1% steps', () => {
    render(<VideoPlayer src="app://x.mp4" />)
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute('step', '0.01')
  })
})

describe('VideoPlayer behind a dialog', () => {
  it('pauses when a dialog opens on top of it', async () => {
    render(<VideoPlayer src="app://x.mp4" />)
    act(() => {
      void video().play()
    })
    expect(video().paused).toBe(false)

    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    act(() => {
      document.body.appendChild(dialog)
    })

    await waitFor(() => expect(video().paused).toBe(true))
    dialog.remove()
  })

  it('keeps playing when the dialog is the one it lives in', async () => {
    render(
      <div aria-modal="true">
        <VideoPlayer src="app://x.mp4" />
      </div>
    )
    act(() => {
      void video().play()
    })
    const other = document.createElement('span')
    act(() => {
      document.body.appendChild(other)
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(video().paused).toBe(false)
    other.remove()
  })
})
