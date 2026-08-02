// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MediaModel } from '@shared/models'
import Media from './Media'

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

describe('Media', () => {
  it('shows the artist name when an artist is present', () => {
    render(<Media {...makeMedia({ artist: { id: 'a1', name: 'Jane Doe' } })} />)
    expect(screen.getByText('Artist: Jane Doe')).toBeInTheDocument()
  })

  it('falls back to "Unknown" when there is no artist, instead of rendering an object', () => {
    render(<Media {...makeMedia({ artist: undefined })} />)
    expect(screen.getByText('Artist: Unknown')).toBeInTheDocument()
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
  })

  it('renders tags, characters and series when provided', () => {
    render(
      <Media
        {...makeMedia({
          tags: [{ id: 't1', name: 'landscape' }],
          characters: [{ id: 'c1', name: 'Hero', series: [] }],
          series: [{ id: 's1', name: 'Wonderland' }]
        })}
      />
    )
    expect(screen.getByText('landscape')).toBeInTheDocument()
    expect(screen.getByText('Hero')).toBeInTheDocument()
    expect(screen.getByText('Wonderland')).toBeInTheDocument()
  })

  it('does not crash when tags/characters are omitted', () => {
    render(<Media {...makeMedia({ tags: undefined, characters: undefined })} />)
    expect(screen.getByText('My picture')).toBeInTheDocument()
  })

  it('shows the SFW indicator based on the sfw flag', () => {
    const { rerender } = render(<Media {...makeMedia({ sfw: true })} />)
    expect(screen.getByTitle('Safe for work')).toBeInTheDocument()

    rerender(<Media {...makeMedia({ sfw: false })} />)
    expect(screen.getByTitle('Explicit content')).toBeInTheDocument()
  })

  it('shows an AI-generated badge only when isAiGenerated is true', () => {
    const { rerender } = render(<Media {...makeMedia({ isAiGenerated: false })} />)
    expect(screen.queryByTitle('Generated using AI')).not.toBeInTheDocument()

    rerender(<Media {...makeMedia({ isAiGenerated: true })} />)
    expect(screen.getByTitle('Generated using AI')).toBeInTheDocument()
  })
})

describe('Media lightbox', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      value: {
        system: {
          showInFolder: vi.fn(),
          copyLocationToClipboard: vi.fn().mockResolvedValue({ success: true, data: undefined })
        }
      },
      writable: true,
      configurable: true
    })
  })

  it('is not shown until the image is clicked', () => {
    render(<Media {...makeMedia()} />)
    expect(screen.queryByRole('button', { name: 'Copy location' })).not.toBeInTheDocument()
  })

  it('opens on click and shows copy/open-in-folder actions', async () => {
    const user = userEvent.setup()
    const { container } = render(<Media {...makeMedia({ route: '/pics/1.png' })} />)

    await user.click(container.querySelector('.media-detail-media') as HTMLElement)

    expect(screen.getByRole('button', { name: 'Copy location' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open in file explorer' })).toBeInTheDocument()
  })

  it('asks the main process to copy the resolved file location to the clipboard', async () => {
    const user = userEvent.setup()
    const { container } = render(<Media {...makeMedia({ route: '/pics/1.png' })} />)
    await user.click(container.querySelector('.media-detail-media') as HTMLElement)

    await user.click(screen.getByRole('button', { name: 'Copy location' }))

    expect(window.api.system.copyLocationToClipboard).toHaveBeenCalledWith('/pics/1.png')
    // The button is icon-only, so the confirmation shows up as its accessible name.
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })

  it('asks the main process to reveal the file in the file explorer', async () => {
    const user = userEvent.setup()
    const { container } = render(<Media {...makeMedia({ route: '/pics/1.png' })} />)
    await user.click(container.querySelector('.media-detail-media') as HTMLElement)

    await user.click(screen.getByRole('button', { name: 'Open in file explorer' }))

    expect(window.api.system.showInFolder).toHaveBeenCalledWith('/pics/1.png')
  })

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(<Media {...makeMedia()} />)
    await user.click(container.querySelector('.media-detail-media') as HTMLElement)

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('button', { name: 'Copy location' })).not.toBeInTheDocument()
  })

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup()
    const { container } = render(<Media {...makeMedia()} />)
    await user.click(container.querySelector('.media-detail-media') as HTMLElement)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('button', { name: 'Copy location' })).not.toBeInTheDocument()
  })
})
