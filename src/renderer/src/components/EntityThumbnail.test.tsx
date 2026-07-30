// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { EntityThumbnail } from './EntityThumbnail'

function setApi(getFiltered: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'api', {
    value: { media: { getFiltered } },
    writable: true,
    configurable: true
  })
}

describe('EntityThumbnail', () => {
  it('renders a cached preview from a matching non-NSFW media item', async () => {
    const getFiltered = vi.fn().mockResolvedValue({
      success: true,
      data: { items: [{ id: 'm1', route: '/pics/a.png', type: 'image' }], total: 1 }
    })
    setApi(getFiltered)

    const { container } = render(<EntityThumbnail kind="tag" id="t1" />)

    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument())
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('app://thumb/')
    )
    expect(getFiltered).toHaveBeenCalledWith({ tagGroups: [['t1']], sfw: true })
  })

  it('uses a preview image for videos too instead of loading the video', async () => {
    const getFiltered = vi.fn().mockResolvedValue({
      success: true,
      data: { items: [{ id: 'm1', route: '/vids/a.mp4', type: 'video' }], total: 1 }
    })
    setApi(getFiltered)

    const { container } = render(<EntityThumbnail kind="character" id="c1" />)

    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument())
    expect(container.querySelector('video')).not.toBeInTheDocument()
    expect(getFiltered).toHaveBeenCalledWith({ characterGroups: [['c1']], sfw: true })
  })

  it('excludes NSFW media from the pool, so an entity with only NSFW media shows a placeholder', async () => {
    const getFiltered = vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } })
    setApi(getFiltered)

    const { container } = render(<EntityThumbnail kind="tag" id="t1" />)

    await waitFor(() =>
      expect(container.querySelector('.entity-thumb-placeholder')).toBeInTheDocument()
    )
    // The `sfw: true` filter is what keeps NSFW-only media out of the pool
    // server-side - a blurred, zoomed-on-hover NSFW preview at this small
    // size reads as a meaningless smudge rather than a useful preview.
    expect(getFiltered).toHaveBeenCalledWith({ tagGroups: [['t1']], sfw: true })
  })

  it('shows a loading shimmer until the preview has decoded', async () => {
    const getFiltered = vi.fn().mockResolvedValue({
      success: true,
      data: { items: [{ id: 'm1', route: '/pics/a.png', type: 'image' }], total: 1 }
    })
    setApi(getFiltered)

    const { container } = render(<EntityThumbnail kind="tag" id="t1" />)

    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument())
    expect(container.querySelector('.entity-thumb-loading')).toBeInTheDocument()

    fireEvent.load(container.querySelector('img') as HTMLImageElement)

    expect(container.querySelector('.entity-thumb-loading')).not.toBeInTheDocument()
  })

  it('shows a placeholder when the preview fails to load', async () => {
    const getFiltered = vi.fn().mockResolvedValue({
      success: true,
      data: { items: [{ id: 'm1', route: '/vids/a.mp4', type: 'video' }], total: 1 }
    })
    setApi(getFiltered)

    const { container } = render(<EntityThumbnail kind="tag" id="t1" />)
    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument())

    fireEvent.error(container.querySelector('img') as HTMLImageElement)

    expect(container.querySelector('.entity-thumb-placeholder')).toBeInTheDocument()
  })

  it('shows a placeholder when there is no matching media', async () => {
    const getFiltered = vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } })
    setApi(getFiltered)

    const { container } = render(<EntityThumbnail kind="artist" id="a1" />)

    await waitFor(() =>
      expect(container.querySelector('.entity-thumb-placeholder')).toBeInTheDocument()
    )
    expect(getFiltered).toHaveBeenCalledWith({ artistId: 'a1', sfw: true })
  })
})
