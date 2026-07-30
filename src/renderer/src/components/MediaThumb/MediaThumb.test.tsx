// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaThumb } from './MediaThumb'

const captureVideoFrame = vi.fn()

vi.mock('./captureVideoFrame', () => ({
  captureVideoFrame: (...args: unknown[]) => captureVideoFrame(...args)
}))

function thumbRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('.media-thumb') as HTMLElement
}

beforeEach(() => {
  captureVideoFrame.mockReset()
  captureVideoFrame.mockResolvedValue(null)
  Object.defineProperty(window, 'api', {
    value: {
      media: { cacheThumbnail: vi.fn().mockResolvedValue({ success: true, data: undefined }) }
    },
    writable: true,
    configurable: true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MediaThumb previews', () => {
  it('loads the small cached preview rather than the original file', () => {
    render(<MediaThumb type="image" route="/pics/a.png" alt="A picture" />)

    const image = screen.getByAltText('A picture')
    expect(image).toHaveAttribute('src', expect.stringContaining('app://thumb/'))
    expect(image).toHaveAttribute('loading', 'lazy')
  })

  it('shows a loading placeholder until the preview has decoded', () => {
    const { container } = render(<MediaThumb type="image" route="/pics/a.png" alt="A picture" />)

    expect(container.querySelector('.media-thumb-loading')).toBeInTheDocument()

    fireEvent.load(screen.getByAltText('A picture'))

    expect(container.querySelector('.media-thumb-loading')).not.toBeInTheDocument()
  })

  it('falls back to an icon when the preview cannot be loaded', () => {
    const { container } = render(<MediaThumb type="video" route="/vids/a.mp4" alt="A video" />)

    fireEvent.error(screen.getByAltText('A video'))

    expect(container.querySelector('.media-thumb-fallback')).toBeInTheDocument()
    expect(container.querySelector('.media-thumb-loading')).not.toBeInTheDocument()
  })
})

describe('MediaThumb videos', () => {
  it('shows a still preview with a play badge and no video element while idle', () => {
    const { container } = render(<MediaThumb type="video" route="/vids/a.mp4" alt="A video" />)

    expect(container.querySelector('video')).not.toBeInTheDocument()
    expect(container.querySelector('.media-thumb-play')).toBeInTheDocument()
  })

  it('only loads the video file on hover', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaThumb type="video" route="/vids/a.mp4" alt="A video" />)

    await user.hover(thumbRoot(container))

    const video = container.querySelector('video') as HTMLVideoElement
    expect(video).toBeInTheDocument()
    expect(video.getAttribute('src')).toContain('app://media/')
    expect(container.querySelector('.media-thumb-play')).not.toBeInTheDocument()
  })

  it('drops the video again when the pointer leaves', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaThumb type="video" route="/vids/a.mp4" alt="A video" />)

    await user.hover(thumbRoot(container))
    await user.unhover(thumbRoot(container))

    expect(container.querySelector('video')).not.toBeInTheDocument()
    expect(container.querySelector('.media-thumb-play')).toBeInTheDocument()
  })
})

describe('MediaThumb gifs', () => {
  it('shows the still preview while idle so it does not animate', () => {
    render(<MediaThumb type="gif" route="/gifs/a.gif" alt="A gif" />)

    expect(screen.getByAltText('A gif')).toHaveAttribute(
      'src',
      expect.stringContaining('app://thumb/')
    )
  })

  it('swaps to the original file on hover so it animates', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaThumb type="gif" route="/gifs/a.gif" alt="A gif" />)

    await user.hover(thumbRoot(container))

    expect(screen.getByAltText('A gif')).toHaveAttribute(
      'src',
      expect.stringContaining('app://media/')
    )
  })

  it('goes back to the still preview when the pointer leaves', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaThumb type="gif" route="/gifs/a.gif" alt="A gif" />)

    await user.hover(thumbRoot(container))
    await user.unhover(thumbRoot(container))

    expect(screen.getByAltText('A gif')).toHaveAttribute(
      'src',
      expect.stringContaining('app://thumb/')
    )
  })

  it('never renders a video element for a gif', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaThumb type="gif" route="/gifs/a.gif" alt="A gif" />)

    await user.hover(thumbRoot(container))

    expect(container.querySelector('video')).not.toBeInTheDocument()
  })

  it('shows a GIF badge while idle so it reads as animated even before hovering', () => {
    const { container } = render(<MediaThumb type="gif" route="/gifs/a.gif" alt="A gif" />)

    expect(container.querySelector('.media-thumb-gif-badge')).toBeInTheDocument()
  })

  it('hides the GIF badge on hover, matching the video play badge', async () => {
    const user = userEvent.setup()
    const { container } = render(<MediaThumb type="gif" route="/gifs/a.gif" alt="A gif" />)

    await user.hover(thumbRoot(container))

    expect(container.querySelector('.media-thumb-gif-badge')).not.toBeInTheDocument()
  })

  it('does not show a GIF badge for images or videos', () => {
    const { container: imageContainer } = render(
      <MediaThumb type="image" route="/pics/a.png" alt="A picture" />
    )
    expect(imageContainer.querySelector('.media-thumb-gif-badge')).not.toBeInTheDocument()

    const { container: videoContainer } = render(
      <MediaThumb type="video" route="/vids/a.mp4" alt="A video" />
    )
    expect(videoContainer.querySelector('.media-thumb-gif-badge')).not.toBeInTheDocument()
  })
})

describe('MediaThumb video capture fallback', () => {
  it('captures a frame when the OS thumbnail fails, showing it instead of the broken icon', async () => {
    captureVideoFrame.mockResolvedValue(new Blob(['fake-png']))
    const { container } = render(<MediaThumb type="video" route="/vids/a.mp4" alt="A video" />)

    fireEvent.error(screen.getByAltText('A video'))

    await waitFor(() =>
      expect(container.querySelector('.media-thumb-fallback')).not.toBeInTheDocument()
    )
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('src', expect.stringMatching(/^blob:/))
  })

  it('persists the captured frame to the thumbnail cache via IPC', async () => {
    captureVideoFrame.mockResolvedValue(new Blob(['fake-png']))
    render(<MediaThumb type="video" route="/vids/a.mp4" alt="A video" />)

    fireEvent.error(screen.getByAltText('A video'))

    await waitFor(() => expect(window.api.media.cacheThumbnail).toHaveBeenCalledTimes(1))
    const [route, bytes] = (window.api.media.cacheThumbnail as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(route).toBe('/vids/a.mp4')
    expect(bytes).toBeInstanceOf(Uint8Array)
  })

  it('keeps the broken icon when capture also fails', async () => {
    captureVideoFrame.mockResolvedValue(null)
    const { container } = render(<MediaThumb type="video" route="/vids/a.mp4" alt="A video" />)

    fireEvent.error(screen.getByAltText('A video'))

    await waitFor(() => expect(captureVideoFrame).toHaveBeenCalled())
    expect(container.querySelector('.media-thumb-fallback')).toBeInTheDocument()
    expect(window.api.media.cacheThumbnail).not.toHaveBeenCalled()
  })

  it('does not attempt a capture for images or gifs', () => {
    const { container: imageContainer } = render(
      <MediaThumb type="image" route="/pics/a.png" alt="A picture" />
    )
    fireEvent.error(screen.getByAltText('A picture'))
    expect(captureVideoFrame).not.toHaveBeenCalled()
    expect(imageContainer.querySelector('.media-thumb-fallback')).toBeInTheDocument()

    const { container: gifContainer } = render(
      <MediaThumb type="gif" route="/gifs/a.gif" alt="A gif" />
    )
    fireEvent.error(screen.getByAltText('A gif'))
    expect(captureVideoFrame).not.toHaveBeenCalled()
    expect(gifContainer.querySelector('.media-thumb-fallback')).toBeInTheDocument()
  })

  it('only attempts capture once even if the thumb errors again', async () => {
    captureVideoFrame.mockResolvedValue(null)
    render(<MediaThumb type="video" route="/vids/a.mp4" alt="A video" />)

    const img = screen.getByAltText('A video')
    fireEvent.error(img)
    await waitFor(() => expect(captureVideoFrame).toHaveBeenCalledTimes(1))

    expect(captureVideoFrame).toHaveBeenCalledTimes(1)
  })
})
