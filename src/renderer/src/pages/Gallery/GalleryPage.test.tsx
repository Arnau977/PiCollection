// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { CharacterModel, MediaModel, SeriesModel, TagModel } from '@shared/models'
import GalleryPage from './GalleryPage'
import { resetGallerySession } from '../../hooks/useGallerySession'

vi.mock('../../components/FilterBar/FilterBar', () => ({
  FilterBar: () => null
}))

const confirmMock = vi.fn().mockResolvedValue(true)

vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => confirmMock
}))

let tagsData: TagModel[] = []
let charactersData: CharacterModel[] = []
let seriesData: SeriesModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useTags: () => ({ data: tagsData, loading: false, error: null, refetch: vi.fn() }),
  useCharacters: () => ({ data: charactersData, loading: false, error: null, refetch: vi.fn() }),
  useSeries: () => ({ data: seriesData, loading: false, error: null, refetch: vi.fn() })
}))

beforeEach(() => {
  // Filters persist in module scope across navigations, so each test starts fresh.
  resetGallerySession()
  tagsData = []
  charactersData = []
  seriesData = []
})

function makeMedia(count: number): MediaModel[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `media-${i}`,
    type: 'image' as const,
    route: `/pic-${i}.png`,
    sfw: true,
    isAiGenerated: false,
    createdAt: i,
    pendingTagging: false
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

  it('always excludes pending media from the query, since pending items belong only under Pending', async () => {
    const getFiltered = vi
      .fn()
      .mockResolvedValue({ success: true, data: { items: makeMedia(1), total: 1 } })
    setApi(getFiltered)

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(getFiltered).toHaveBeenCalledWith(
        expect.objectContaining({ pendingTagging: false }),
        expect.anything()
      )
    )
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

describe('GalleryPage return-from-media scroll centering', () => {
  const matchMediaSpy = window.matchMedia

  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    window.matchMedia = matchMediaSpy
    vi.useRealTimers()
  })

  function mockPrefersReducedMotion(matches: boolean): void {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  }

  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
  })

  function rect(partial: Partial<DOMRect>): DOMRect {
    return { x: 0, y: 0, toJSON: () => ({}), ...partial } as DOMRect
  }

  // jsdom never lays anything out (every element defaults to an all-zero
  // rect), so the "already visible" path needs the scroll region and the
  // target card stubbed with rects that actually overlap.
  function mockCardVisibility(mediaId: string, visible: boolean): void {
    Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
      if (this.classList.contains('gallery-scroll-region')) {
        return rect({ top: 0, bottom: 600, height: 600, left: 0, right: 800, width: 800 })
      }
      if (this.getAttribute('data-media-id') === mediaId) {
        return visible
          ? rect({ top: 100, bottom: 300, height: 200, left: 0, right: 200, width: 200 })
          : rect({ top: 5000, bottom: 5200, height: 200, left: 0, right: 200, width: 200 })
      }
      return originalGetBoundingClientRect.call(this)
    }
  }

  it('scrolls the media item you came back from into view, centered and animated', async () => {
    mockPrefersReducedMotion(false)
    const scrollIntoViewMock = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }))

    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: '/gallery', state: { focusMediaId: '1' } }]}>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled())
    const target = container.querySelector('[data-media-id="1"]')
    expect(scrollIntoViewMock.mock.contexts[0]).toBe(target)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
  })

  it('jumps instantly instead of animating when the user prefers reduced motion', async () => {
    mockPrefersReducedMotion(true)
    const scrollIntoViewMock = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }))

    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: '/gallery', state: { focusMediaId: '1' } }]}>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled())
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' })
    // Nothing to wait out here - there's no scroll animation, so the highlight
    // shows right away instead of waiting on a scrollend that'll never fire.
    expect(container.querySelector('[data-media-id="1"] .media-card')).toHaveClass(
      'gallery-return-highlight'
    )
  })

  it('waits for the smooth scroll to settle before highlighting, then clears the highlight', async () => {
    mockPrefersReducedMotion(false)
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }))

    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: '/gallery', state: { focusMediaId: '1' } }]}>
        <GalleryPage />
      </MemoryRouter>
    )
    const card = (): Element | null => container.querySelector('[data-media-id="1"] .media-card')

    await waitFor(() => expect(card()).toBeInTheDocument())
    // jsdom never actually scrolls, so no native `scrollend` fires - the
    // highlight only shows up once the settle fallback kicks in, not on the
    // same tick as the scrollIntoView call.
    expect(card()).not.toHaveClass('gallery-return-highlight')

    await waitFor(() => expect(card()).toHaveClass('gallery-return-highlight'))

    await vi.advanceTimersByTimeAsync(2500)

    expect(card()).not.toHaveClass('gallery-return-highlight')
  })

  it('skips the scroll animation when the item is already sufficiently visible, highlighting it right away', async () => {
    mockPrefersReducedMotion(false)
    mockCardVisibility('1', true)
    const scrollIntoViewMock = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }))

    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: '/gallery', state: { focusMediaId: '1' } }]}>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(container.querySelector('[data-media-id="1"] .media-card')).toHaveClass(
        'gallery-return-highlight'
      )
    )
    expect(scrollIntoViewMock).not.toHaveBeenCalled()
  })

  it('does not scroll anything when arriving without a focusMediaId', async () => {
    const scrollIntoViewMock = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
    setApi(vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }))

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Media count: 3')).toBeInTheDocument())
    expect(scrollIntoViewMock).not.toHaveBeenCalled()
  })

  it('jumps to the page containing the focused item when it is not on the loaded one (e.g. arriving from Home instead of the gallery itself), then centers it', async () => {
    const scrollIntoViewMock = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
    // Default page size is 60 - item at index 65 lives on page 2 (0-based
    // page 1), not the page 1 the gallery session would otherwise start on.
    const getFiltered = vi.fn().mockImplementation((filters: { offset?: number }) => {
      const offset = filters.offset ?? 0
      return Promise.resolve({
        success: true,
        data: { items: makeMedia(60).map((item, i) => ({ ...item, id: String(offset + i) })), total: 130 }
      })
    })
    setApi(getFiltered)

    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/gallery', state: { focusMediaId: '65', focusIndex: 65 } }]}
      >
        <GalleryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled())
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
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

describe('GalleryPage batch selection and delete', () => {
  beforeEach(() => {
    window.localStorage.clear()
    confirmMock.mockReset()
    confirmMock.mockResolvedValue(true)
  })

  function setApiWithDelete(
    getFiltered: ReturnType<typeof vi.fn>,
    deleteFn: ReturnType<typeof vi.fn>
  ): void {
    Object.defineProperty(window, 'api', {
      value: { media: { getFiltered, delete: deleteFn } },
      writable: true,
      configurable: true
    })
  }

  it('shows the bulk action bar with a count once an item is selected', async () => {
    const user = userEvent.setup()
    setApiWithDelete(
      vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }),
      vi.fn()
    )

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('button', { name: 'Select media-0' }))

    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('"select all on this page" selects every currently loaded item', async () => {
    const user = userEvent.setup()
    setApiWithDelete(
      vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }),
      vi.fn()
    )

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await screen.findByRole('button', { name: 'Select media-0' })
    await user.click(screen.getByRole('button', { name: 'Select media-0' }))
    await user.click(screen.getByRole('button', { name: 'Select all on this page' }))

    expect(screen.getByText('3 selected')).toBeInTheDocument()
  })

  it('clears the selection', async () => {
    const user = userEvent.setup()
    setApiWithDelete(
      vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }),
      vi.fn()
    )

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('button', { name: 'Select media-0' }))
    await user.click(screen.getByRole('button', { name: 'Clear selection' }))

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  })

  it('deletes every selected item on confirm, then clears the selection and refetches', async () => {
    const user = userEvent.setup()
    const getFiltered = vi
      .fn()
      .mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } })
    const deleteFn = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApiWithDelete(getFiltered, deleteFn)

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('button', { name: 'Select media-0' }))
    await user.click(screen.getByRole('button', { name: 'Select media-1' }))
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))

    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ danger: true }))
    await waitFor(() => expect(deleteFn).toHaveBeenCalledTimes(2))
    expect(deleteFn).toHaveBeenCalledWith('0')
    expect(deleteFn).toHaveBeenCalledWith('1')
    await waitFor(() => expect(screen.queryByText('2 selected')).not.toBeInTheDocument())
    await waitFor(() => expect(getFiltered).toHaveBeenCalledTimes(2))
  })

  it('shows a Deleting label and disables the button while the batch delete is in flight', async () => {
    const user = userEvent.setup()
    const deleteFn = vi.fn().mockReturnValue(new Promise(() => {}))
    setApiWithDelete(
      vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }),
      deleteFn
    )

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('button', { name: 'Select media-0' }))
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))

    expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled()
  })

  it('does not delete anything when the confirm dialog is dismissed', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const user = userEvent.setup()
    const deleteFn = vi.fn()
    setApiWithDelete(
      vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }),
      deleteFn
    )

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('button', { name: 'Select media-0' }))
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))

    expect(deleteFn).not.toHaveBeenCalled()
  })
})

describe('GalleryPage batch metadata edit', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  function setApiWithBatchEdit(
    getFiltered: ReturnType<typeof vi.fn>,
    batchUpdateAssociations: ReturnType<typeof vi.fn>
  ): void {
    Object.defineProperty(window, 'api', {
      value: { media: { getFiltered, batchUpdateAssociations } },
      writable: true,
      configurable: true
    })
  }

  it('opens the batch edit dialog from the bulk bar, showing the selected count', async () => {
    const user = userEvent.setup()
    setApiWithBatchEdit(
      vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }),
      vi.fn()
    )

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('button', { name: 'Select media-0' }))
    await user.click(screen.getByRole('button', { name: 'Edit metadata' }))

    expect(screen.getByText('Edit metadata for 1 items')).toBeInTheDocument()
  })

  it('applies the batch edit for every selected id, then clears selection and refetches', async () => {
    tagsData = [{ id: 't1', name: 'sunset', createdAt: 1 }]
    const user = userEvent.setup()
    const getFiltered = vi
      .fn()
      .mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } })
    const batchUpdateAssociations = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApiWithBatchEdit(getFiltered, batchUpdateAssociations)

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('button', { name: 'Select media-0' }))
    await user.click(screen.getByRole('button', { name: 'Select media-1' }))
    await user.click(screen.getByRole('button', { name: 'Edit metadata' }))

    await user.type(screen.getByRole('combobox', { name: /^Add tags/ }), 'sunset')
    await user.click(await screen.findByRole('option', { name: 'sunset' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() =>
      expect(batchUpdateAssociations).toHaveBeenCalledWith({
        mediaIds: ['0', '1'],
        addTagIds: ['t1'],
        removeTagIds: [],
        addCharacterIds: [],
        removeCharacterIds: [],
        addSeriesIds: [],
        removeSeriesIds: []
      })
    )
    await waitFor(() => expect(screen.queryByText('2 selected')).not.toBeInTheDocument())
    await waitFor(() => expect(getFiltered).toHaveBeenCalledTimes(2))
  })

  it('applies an SFW/NSFW batch change', async () => {
    const user = userEvent.setup()
    const getFiltered = vi
      .fn()
      .mockResolvedValue({ success: true, data: { items: makeMedia(2), total: 2 } })
    const batchUpdateAssociations = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApiWithBatchEdit(getFiltered, batchUpdateAssociations)

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('button', { name: 'Select media-0' }))
    await user.click(screen.getByRole('button', { name: 'Edit metadata' }))
    await user.click(screen.getByRole('radio', { name: 'Mark as NSFW' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() =>
      expect(batchUpdateAssociations).toHaveBeenCalledWith(
        expect.objectContaining({ mediaIds: ['0'], sfw: false })
      )
    )
  })

  it('closes the dialog without applying when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const batchUpdateAssociations = vi.fn()
    setApiWithBatchEdit(
      vi.fn().mockResolvedValue({ success: true, data: { items: makeMedia(3), total: 3 } }),
      batchUpdateAssociations
    )

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>
    )

    await user.click(await screen.findByRole('button', { name: 'Select media-0' }))
    await user.click(screen.getByRole('button', { name: 'Edit metadata' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Edit metadata for 1 items')).not.toBeInTheDocument()
    expect(batchUpdateAssociations).not.toHaveBeenCalled()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })
})
