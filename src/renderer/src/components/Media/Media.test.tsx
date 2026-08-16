// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { MediaModel } from '@shared/models'
import { __resetEntityListCachesForTests } from '../../hooks/useEntityLists'
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
    pendingTagging: false,
    ...overrides
  }
}

/** `Media` fetches the full series/character lists (via `useSeries`/`useCharacters`) to resolve a
 * linked series/character's ancestors. */
function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      series: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
      character: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
      media: { findSimilar: vi.fn().mockResolvedValue({ success: true, data: [] }) },
      ...overrides
    },
    writable: true,
    configurable: true
  })
}

beforeEach(() => {
  __resetEntityListCachesForTests()
  setApi()
})

describe('Media', () => {
  it('shows the artist name under its own heading when an artist is present', () => {
    render(<Media {...makeMedia({ artist: { id: 'a1', name: 'Jane Doe' } })} />)
    expect(screen.getByRole('heading', { name: 'Artist' })).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('falls back to "Unknown" when there is no artist, instead of rendering an object', () => {
    render(<Media {...makeMedia({ artist: undefined })} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
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

  it("shows a linked series' parent for context even when only the child is directly linked", async () => {
    setApi({
      series: {
        getAll: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { id: 'p1', name: 'Honkai (series)', parentId: null },
            { id: 's1', name: 'Honkai: Star Rail', parentId: 'p1' }
          ]
        })
      }
    })

    render(<Media {...makeMedia({ series: [{ id: 's1', name: 'Honkai: Star Rail' }] })} />)

    expect(await screen.findByText('Honkai (series)')).toBeInTheDocument()
    expect(screen.getByText('Honkai: Star Rail')).toBeInTheDocument()
  })

  it("shows a linked character's parent for context even when only the child is directly linked", async () => {
    setApi({
      series: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
      character: {
        getAll: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { id: 'p1', name: 'Elizabeth Bathory', series: [], parentId: null },
            { id: 'c1', name: 'Elizabeth Bathory (Brave)', series: [], parentId: 'p1' }
          ]
        })
      }
    })

    render(
      <Media {...makeMedia({ characters: [{ id: 'c1', name: 'Elizabeth Bathory (Brave)', series: [] }] })} />
    )

    expect(await screen.findByText('Elizabeth Bathory')).toBeInTheDocument()
    expect(screen.getByText('Elizabeth Bathory (Brave)')).toBeInTheDocument()
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

describe('Media adjacent navigation', () => {
  it('does not render the nav zones without an onNavigate callback', () => {
    render(<Media {...makeMedia()} previousId="0" nextId="2" />)

    expect(screen.queryByRole('button', { name: 'Previous image' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument()
  })

  it('only renders a side zone when the matching sibling id is present', () => {
    const onNavigate = vi.fn()
    render(<Media {...makeMedia()} previousId={null} nextId="2" onNavigate={onNavigate} />)

    expect(screen.queryByRole('button', { name: 'Previous image' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument()
  })

  it('navigates to the previous/next id when the corresponding zone is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<Media {...makeMedia()} previousId="0" nextId="2" onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: 'Next image' }))
    expect(onNavigate).toHaveBeenCalledWith('2')

    await user.click(screen.getByRole('button', { name: 'Previous image' }))
    expect(onNavigate).toHaveBeenCalledWith('0')
  })

  it('still opens the lightbox when clicking the image itself, not the side zones', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    setApi({
      system: {
        showInFolder: vi.fn(),
        copyLocationToClipboard: vi.fn().mockResolvedValue({ success: true, data: undefined })
      }
    })
    render(<Media {...makeMedia()} previousId="0" nextId="2" onNavigate={onNavigate} />)

    await user.click(screen.getByAltText('My picture'))

    expect(screen.getByRole('button', { name: 'Copy location' })).toBeInTheDocument()
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('also renders nav zones over a video', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(
      <Media
        {...makeMedia({ type: 'video', route: '/vid.mp4' })}
        previousId="0"
        nextId="2"
        onNavigate={onNavigate}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Next image' }))
    expect(onNavigate).toHaveBeenCalledWith('2')
  })

  it('does not open the lightbox when clicking a video (native controls own it)', async () => {
    const user = userEvent.setup()
    render(<Media {...makeMedia({ type: 'video', route: '/vid.mp4' })} />)

    const video = document.querySelector('video') as HTMLVideoElement
    await user.click(video)

    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
  })
})

describe('Media lightbox', () => {
  beforeEach(() => {
    setApi({
      system: {
        showInFolder: vi.fn(),
        copyLocationToClipboard: vi.fn().mockResolvedValue({ success: true, data: undefined })
      }
    })
  })

  it('is not shown until the image is clicked', () => {
    render(<Media {...makeMedia()} />)
    expect(screen.queryByRole('button', { name: 'Copy location' })).not.toBeInTheDocument()
  })

  it('opens on click and shows copy/open-in-folder actions', async () => {
    const user = userEvent.setup()
    render(<Media {...makeMedia({ route: '/pics/1.png' })} />)

    await user.click(screen.getByAltText('My picture'))

    expect(screen.getByRole('button', { name: 'Copy location' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open in file explorer' })).toBeInTheDocument()
  })

  it('asks the main process to copy the resolved file location to the clipboard', async () => {
    const user = userEvent.setup()
    render(<Media {...makeMedia({ route: '/pics/1.png' })} />)
    await user.click(screen.getByAltText('My picture'))

    await user.click(screen.getByRole('button', { name: 'Copy location' }))

    expect(window.api.system.copyLocationToClipboard).toHaveBeenCalledWith('/pics/1.png')
    // The button is icon-only, so the confirmation shows up as its accessible name.
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })

  it('asks the main process to reveal the file in the file explorer', async () => {
    const user = userEvent.setup()
    render(<Media {...makeMedia({ route: '/pics/1.png' })} />)
    await user.click(screen.getByAltText('My picture'))

    await user.click(screen.getByRole('button', { name: 'Open in file explorer' }))

    expect(window.api.system.showInFolder).toHaveBeenCalledWith('/pics/1.png')
  })

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup()
    render(<Media {...makeMedia()} />)
    await user.click(screen.getByAltText('My picture'))

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('button', { name: 'Copy location' })).not.toBeInTheDocument()
  })

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<Media {...makeMedia()} />)
    await user.click(screen.getByAltText('My picture'))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('button', { name: 'Copy location' })).not.toBeInTheDocument()
  })
})

describe('Media similar panel', () => {
  it('renders similar media returned by the API', async () => {
    setApi({
      media: {
        findSimilar: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              media: {
                id: '2',
                name: 'Other picture',
                type: 'image',
                route: '/pics/2.png',
                sfw: true,
                isAiGenerated: false,
                createdAt: 1,
                pendingTagging: false
              },
              distance: 3
            }
          ]
        })
      }
    })

    render(
      <MemoryRouter>
        <Media {...makeMedia()} />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: 'Similar media' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Other picture' })).toBeInTheDocument()
  })
})
