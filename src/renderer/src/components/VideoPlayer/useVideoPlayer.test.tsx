// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { useVideoPlayer, type VideoPlayerState } from './useVideoPlayer'
import { loadVideoPlayerPrefs, saveVideoPlayerPrefs } from './videoPlayerPrefs'

let player: VideoPlayerState
let video: HTMLVideoElement

function Host({ muted }: { muted?: boolean }): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null)
  player = useVideoPlayer(ref, { muted })
  return <video ref={ref} data-testid="video" />
}

function setDuration(value: number): void {
  Object.defineProperty(video, 'duration', { configurable: true, value })
  act(() => {
    video.dispatchEvent(new Event('loadedmetadata'))
  })
}

function mount(muted?: boolean): void {
  const { getByTestId } = render(<Host muted={muted} />)
  video = getByTestId('video') as HTMLVideoElement
}

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

describe('useVideoPlayer', () => {
  it('restores loop, volume and mute from the last video, but not speed', () => {
    saveVideoPlayerPrefs({ loop: true, volume: 0.4, muted: true })
    mount()

    expect(video.loop).toBe(true)
    expect(video.volume).toBeCloseTo(0.4)
    expect(video.muted).toBe(true)
    expect(player.rate).toBe(1)
  })

  it('skips 5 s, clamped to the video', () => {
    mount()
    setDuration(10)
    act(() => player.seek(2))

    act(() => player.skip(-5))
    expect(video.currentTime).toBe(0)
    act(() => player.skip(5))
    act(() => player.skip(5))
    act(() => player.skip(5))
    expect(video.currentTime).toBe(10)
  })

  it('keeps duration null until it is finite', () => {
    mount()
    setDuration(Infinity)
    expect(player.duration).toBeNull()

    setDuration(12)
    expect(player.duration).toBe(12)
  })

  it('forces mute for a host that asks, without saving it', () => {
    mount(true)

    expect(video.muted).toBe(true)
    expect(loadVideoPlayerPrefs().muted).toBe(false)
  })

  it('mutes at volume 0 and unmutes to the last level held, not the slide past it', () => {
    vi.useFakeTimers()
    mount()
    act(() => player.setVolume(0.6))
    act(() => vi.advanceTimersByTime(500))
    act(() => player.setVolume(0.02))
    act(() => player.setVolume(0))
    vi.useRealTimers()
    expect(video.muted).toBe(true)
    expect(video.volume).toBeCloseTo(0.6)

    act(() => player.toggleMute())
    expect(video.muted).toBe(false)
    expect(video.volume).toBeCloseTo(0.6)
  })

  it('remembers loop and volume changes, but not speed', () => {
    mount()
    act(() => player.setLoop(true))
    act(() => player.setVolume(0.3))
    act(() => player.setRate(2))

    expect(loadVideoPlayerPrefs()).toEqual({ loop: true, volume: 0.3, muted: false })
    expect(video.playbackRate).toBe(2)
  })
})
