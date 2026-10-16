// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { useFrameRate, FALLBACK_FPS } from './useFrameRate'

let fps = 0
function Host(): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null)
  fps = useFrameRate(ref)
  return <video ref={ref} />
}

type FrameCallback = (now: number, meta: { mediaTime: number }) => void

afterEach(() => {
  delete (HTMLVideoElement.prototype as Partial<{ requestVideoFrameCallback: unknown }>)
    .requestVideoFrameCallback
})

describe('useFrameRate', () => {
  it('falls back to 30 fps where frames can not be observed', () => {
    render(<Host />)
    expect(fps).toBe(FALLBACK_FPS)
  })

  it('measures the rate from the frames the video presents', () => {
    const pending: FrameCallback[] = []
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: (callback: FrameCallback) => pending.push(callback)
    })
    render(<Host />)

    for (let frame = 0; frame < 12; frame++) {
      const callback = pending.shift()
      act(() => callback?.(frame * 41, { mediaTime: frame / 24 }))
    }

    expect(fps).toBeCloseTo(24, 0)
  })
})
