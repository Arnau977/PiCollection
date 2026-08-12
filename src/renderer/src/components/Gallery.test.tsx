// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { MediaModel } from '@shared/models'
import Gallery from './Gallery'

function makeMedia(overrides: Partial<MediaModel> = {}): MediaModel {
  return {
    id: '1',
    name: 'My picture',
    type: 'image',
    route: '/pics/1.png',
    sfw: true,
    isAiGenerated: false,
    createdAt: Date.now(),
    ...overrides
  }
}

describe('Gallery', () => {
  it('renders an item per media', () => {
    render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ id: '1', name: 'A' }), makeMedia({ id: '2', name: 'B' })]} />
      </MemoryRouter>
    )

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renders an <img> pointing at the cached thumbnail protocol', () => {
    render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ route: '/pics/1.png' })]} />
      </MemoryRouter>
    )

    const img = screen.getByAltText('My picture')
    expect(img.tagName).toBe('IMG')
    expect(img).toHaveAttribute('src', expect.stringContaining('app://thumb/'))
  })

  it('shows a still preview for video media rather than loading the video up front', () => {
    const { container } = render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ type: 'video', route: '/vids/1.mp4' })]} />
      </MemoryRouter>
    )

    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('app://thumb/')
    )
    expect(container.querySelector('.media-thumb-play')).not.toBeNull()
  })

  it('shows a GIF badge for gif media rather than animating it up front', () => {
    const { container } = render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ type: 'gif', route: '/gifs/1.gif' })]} />
      </MemoryRouter>
    )

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('app://thumb/')
    )
    expect(container.querySelector('.media-thumb-gif-badge')).not.toBeNull()
  })

  it('links each item to its media detail route', () => {
    render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ id: 'abc-123' })]} />
      </MemoryRouter>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/media/abc-123')
  })

  it('renders an empty state with no media', () => {
    render(
      <MemoryRouter>
        <Gallery media={[]} />
      </MemoryRouter>
    )

    expect(screen.getByText('No media yet')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('blurs NSFW thumbnails when blurNsfw is enabled', () => {
    const { container } = render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ sfw: false })]} blurNsfw />
      </MemoryRouter>
    )

    expect(container.querySelector('.thumb-wrap.nsfw-blur')).not.toBeNull()
    expect(screen.getByText('Hover to reveal')).toBeInTheDocument()
  })

  it('does not blur SFW thumbnails even when blurNsfw is enabled', () => {
    const { container } = render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ sfw: true })]} blurNsfw />
      </MemoryRouter>
    )

    expect(container.querySelector('.thumb-wrap.nsfw-blur')).toBeNull()
  })

  it('does not blur NSFW thumbnails when blurNsfw is disabled', () => {
    const { container } = render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ sfw: false })]} blurNsfw={false} />
      </MemoryRouter>
    )

    expect(container.querySelector('.thumb-wrap.nsfw-blur')).toBeNull()
  })

  it('hides media names when hideNames is enabled', () => {
    render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ name: 'Secret name' })]} hideNames />
      </MemoryRouter>
    )

    expect(screen.queryByText('Secret name')).not.toBeInTheDocument()
  })

  it('shows media names when hideNames is disabled', () => {
    render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ name: 'Visible name' })]} hideNames={false} />
      </MemoryRouter>
    )

    expect(screen.getByText('Visible name')).toBeInTheDocument()
  })

  it('exposes the full name as a tooltip so truncated names stay readable', () => {
    const longName = 'a-really-long-media-file-name-that-will-definitely-be-truncated-on-screen'
    render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ name: longName })]} />
      </MemoryRouter>
    )

    expect(screen.getByText(longName)).toHaveAttribute('title', longName)
  })

  it('defaults the grid thumbnail size to the comfortable density', () => {
    const { container } = render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ id: '1' })]} />
      </MemoryRouter>
    )

    const grid = container.querySelector('.gallery-grid') as HTMLElement
    expect(grid.style.getPropertyValue('--gallery-thumb-min')).toBe('160px')
  })

  it('sets a smaller grid thumbnail size for the compact density', () => {
    const { container } = render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ id: '1' })]} density="compact" />
      </MemoryRouter>
    )

    const grid = container.querySelector('.gallery-grid') as HTMLElement
    expect(grid.style.getPropertyValue('--gallery-thumb-min')).toBe('96px')
  })

  it('sets a larger grid thumbnail size for the large density', () => {
    const { container } = render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ id: '1' })]} density="large" />
      </MemoryRouter>
    )

    const grid = container.querySelector('.gallery-grid') as HTMLElement
    expect(grid.style.getPropertyValue('--gallery-thumb-min')).toBe('240px')
  })

  it('does not render selection checkboxes when onToggleSelect is not provided', () => {
    render(
      <MemoryRouter>
        <Gallery media={[makeMedia({ id: 'abc-123' })]} />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('toggles selection via the checkbox without navigating', async () => {
    const user = userEvent.setup()
    const onToggleSelect = vi.fn()
    render(
      <MemoryRouter>
        <Gallery
          media={[makeMedia({ id: 'abc-123', name: 'A' })]}
          selectedIds={new Set()}
          onToggleSelect={onToggleSelect}
        />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: 'Select A' }))

    expect(onToggleSelect).toHaveBeenCalledWith('abc-123')
  })

  it('marks a selected item as pressed, with a deselect label', () => {
    render(
      <MemoryRouter>
        <Gallery
          media={[makeMedia({ id: 'abc-123', name: 'A' })]}
          selectedIds={new Set(['abc-123'])}
          onToggleSelect={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: 'Deselect A' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
