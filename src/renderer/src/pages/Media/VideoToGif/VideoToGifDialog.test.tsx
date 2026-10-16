// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import type { MediaModel } from '@shared/models'
import { VideoToGifDialog } from './VideoToGifDialog'
import { useVideoToGif } from './useVideoToGif'
import { LONG_CLIP_SECONDS } from './gifPresets'

const video = { id: 'v1', route: 'clips/loop.mp4', name: 'loop', type: 'video' } as MediaModel

function loadDuration(seconds: number): void {
  const element = document.querySelector('video')!
  Object.defineProperty(element, 'duration', { configurable: true, value: seconds })
  act(() => {
    element.dispatchEvent(new Event('loadedmetadata'))
  })
}

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

describe('VideoToGifDialog', () => {
  it('allows clips past the old 10 s cap, with a note from 30 s', () => {
    render(
      <VideoToGifDialog
        video={video}
        initialClip={{ start: 0, end: 60 }}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    )
    loadDuration(90)

    expect(screen.getByRole('button', { name: 'Create GIF' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Long GIFs can get very large and slow to make.')).toBeInTheDocument()
  })

  it('opens with the section marked in the player, and picks the clip on its timeline', () => {
    render(
      <VideoToGifDialog
        video={video}
        initialClip={{ start: 3, end: 18 }}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    )
    loadDuration(40)

    expect(screen.getByText(/^15 s/)).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeInTheDocument()
  })

  it('starts with the first 5 seconds when nothing was marked', () => {
    render(<VideoToGifDialog video={video} onClose={vi.fn()} onCreated={vi.fn()} />)
    loadDuration(40)

    expect(screen.getByText(/^5 s/)).toBeInTheDocument()
  })
})

describe('useVideoToGif', () => {
  it('still rejects an end before the start, and nothing else about the length', () => {
    const { result } = renderHook(() =>
      useVideoToGif({ video, onCreated: vi.fn(), describeError: (code) => code })
    )
    act(() => result.current.setDuration(120))
    act(() => result.current.setClip({ start: 5, end: 2 }))
    expect(result.current.clipError).toBe('order')

    act(() => result.current.setClip({ start: 0, end: 100 }))
    expect(result.current.clipError).toBeNull()
    expect(LONG_CLIP_SECONDS).toBe(30)
  })
})
