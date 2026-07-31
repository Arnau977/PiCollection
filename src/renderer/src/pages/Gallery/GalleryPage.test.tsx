// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { MediaModel } from '@shared/models'
import GalleryPage from './GalleryPage'
import { resetGallerySession } from '../../hooks/useGallerySession'

vi.mock('../../components/FilterBar/FilterBar', () => ({
  FilterBar: () => null
}))

beforeEach(() => {
  // Filters persist in module scope across navigations, so each test starts fresh.
  resetGallerySession()
})

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

function setApi(getFiltered: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'api', {
    value: { media: { getFiltered } },
    writable: true,
    configurable: true
  })
}

describe('GalleryPage pagination', () => {
  beforeEach(() => {
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(60), total: 130 } }))
  })

  it('shows the page title as a heading', async () => {
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Your gallery' })).toBeInTheDocument()
  })

  it('requests the first page with the default page size and shows page 1 of N', async () => {
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/Media count: 130/)).toBeInTheDocument())
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()

    const getFiltered = (
      window as unknown as { api: { media: { getFiltered: ReturnType<typeof vi.fn> } } }
    ).api.media.getFiltered
    expect(getFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 60, offset: 0 }),
      expect.anything()
    )
  })

  it('disables Previous on the first page and advances offset when Next is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeInTheDocument())
    const getFiltered = (
      window as unknown as { api: { media: { getFiltered: ReturnType<typeof vi.fn> } } }
    ).api.media.getFiltered
    expect(getFiltered).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 60, offset: 60 }),
      expect.anything()
    )
    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled()
  })

  it('disables Next on the last page', async () => {
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(10), total: 10 } }))

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Page 1 of 1')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('does not render pagination controls when there is no media', async () => {
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } }))

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Media count: 0')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })
})

describe('GalleryPage active filters indicator', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('does not show the active-filters banner when nothing is filtered', async () => {
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } }))

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Media count: 0')).toBeInTheDocument())
    expect(screen.queryByText('Filters are hiding some media')).not.toBeInTheDocument()
  })

  it('shows the banner and a working clear button when a default filter is active', async () => {
    window.localStorage.setItem(
      'picollection:gallery-defaults',
      JSON.stringify({ sfw: true, sortProp: 'createdAt', sortDesc: true, blurNsfw: true })
    )
    const getFiltered = vi
      .fn()
      .mockResolvedValue({ success: true, data: { items: makeMedia(2), total: 2 } })
    setApi(getFiltered)
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(getFiltered).toHaveBeenCalledTimes(1))
    expect(getFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ sfw: true }),
      expect.anything()
    )
    expect(screen.getByText('Filters are hiding some media')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(getFiltered).toHaveBeenCalledTimes(2))
    const lastCallFilters = getFiltered.mock.calls[1][0]
    expect(lastCallFilters.sfw).toBeUndefined()
    expect(screen.queryByText('Filters are hiding some media')).not.toBeInTheDocument()
  })
})

describe('GalleryPage session persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps the current page after leaving and coming back to the gallery', async () => {
    const user = userEvent.setup()
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(60), total: 130 } }))

    const { unmount } = render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeInTheDocument())

    // Navigating away unmounts the page.
    unmount()

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeInTheDocument())
  })

  it('keeps active filters after leaving and coming back', async () => {
    window.localStorage.setItem(
      'picollection:gallery-defaults',
      JSON.stringify({ sfw: true, sortProp: 'createdAt', sortDesc: true, blurNsfw: true })
    )
    const getFiltered = vi
      .fn()
      .mockResolvedValue({ success: true, data: { items: makeMedia(2), total: 2 } })
    setApi(getFiltered)

    const { unmount } = render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )
    await waitFor(() =>
      expect(screen.getByText('Filters are hiding some media')).toBeInTheDocument()
    )
    unmount()

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(screen.getByText('Filters are hiding some media')).toBeInTheDocument()
    )
  })

  it('starts clean again once the filters are cleared', async () => {
    window.localStorage.setItem(
      'picollection:gallery-defaults',
      JSON.stringify({ sfw: true, sortProp: 'createdAt', sortDesc: true, blurNsfw: true })
    )
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(2), total: 2 } }))
    const user = userEvent.setup()

    const { unmount } = render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }))
    unmount()

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Media count: 2')).toBeInTheDocument())
    expect(screen.queryByText('Filters are hiding some media')).not.toBeInTheDocument()
  })
})

describe('GalleryPage toolbar', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(60), total: 130 } }))
  })

  it('requests a new page size and resets to page 1 when the page-size select changes', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Per page'), '120')

    await waitFor(() => expect(screen.getByText('Page 1 of 2')).toBeInTheDocument())
    const getFiltered = (
      window as unknown as { api: { media: { getFiltered: ReturnType<typeof vi.fn> } } }
    ).api.media.getFiltered
    expect(getFiltered).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 120, offset: 0 }),
      expect.anything()
    )
  })

  it('changes the grid density and persists the choice', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Large' }))

    const grid = container.querySelector('.gallery-grid') as HTMLElement
    expect(grid.style.getPropertyValue('--gallery-thumb-min')).toBe('240px')
    expect(
      JSON.parse(window.localStorage.getItem('picollection:gallery-defaults') ?? '{}').density
    ).toBe('large')
  })
})
