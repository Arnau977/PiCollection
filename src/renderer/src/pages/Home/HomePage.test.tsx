// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { MediaModel, StatsSummary } from '@shared/models'
import HomePage from './HomePage'

function makeMedia(count: number): MediaModel[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `media-${i}`,
    type: 'image' as const,
    route: `/pic-${i}.png`,
    sfw: true,
    isAiGenerated: false,
    createdAt: i
  }))
}

const emptyStats: StatsSummary = {
  topArtists: [],
  topTags: [],
  topCharacters: [],
  topSeries: []
}

function setApi(overrides: {
  getFiltered?: ReturnType<typeof vi.fn>
  getSummary?: ReturnType<typeof vi.fn>
}): void {
  Object.defineProperty(window, 'api', {
    value: {
      media: {
        getFiltered:
          overrides.getFiltered ??
          vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } })
      },
      stats: {
        getSummary:
          overrides.getSummary ?? vi.fn().mockResolvedValue({ success: true, data: emptyStats })
      }
    },
    writable: true,
    configurable: true
  })
}

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  setApi({})
})

describe('HomePage', () => {
  it('shows the page title', () => {
    renderHomePage()
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
  })

  it('requests the most recent media sorted by creation date', async () => {
    const getFiltered = vi
      .fn()
      .mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } })
    setApi({ getFiltered })
    renderHomePage()

    await waitFor(() => expect(getFiltered).toHaveBeenCalled())
    expect(getFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 12 }),
      expect.objectContaining({ prop: 'createdAt', desc: true })
    )
    expect(await screen.findByText('media-0')).toBeInTheDocument()
  })

  it('shows a link to the full gallery', () => {
    renderHomePage()
    expect(screen.getByRole('link', { name: 'View full gallery' })).toHaveAttribute(
      'href',
      '/gallery'
    )
  })

  it('renders the top artists/tags/characters/series stats panels', async () => {
    const getSummary = vi.fn().mockResolvedValue({
      success: true,
      data: {
        topArtists: [{ id: 'a1', name: 'Jane Doe', count: 5 }],
        topTags: [{ id: 't1', name: 'landscape', count: 3 }],
        topCharacters: [{ id: 'c1', name: 'Alice', count: 2 }],
        topSeries: [{ id: 's1', name: 'Wonderland', count: 1 }]
      }
    })
    setApi({ getSummary })
    renderHomePage()

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('landscape')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Wonderland')).toBeInTheDocument()
  })

  it('shows a "not enough data" message for an empty stats panel', async () => {
    renderHomePage()

    const noDataMessages = await screen.findAllByText('Not enough data yet')
    expect(noDataMessages).toHaveLength(4)
  })
})
