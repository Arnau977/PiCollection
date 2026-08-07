// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SeriesModel } from '@shared/models'
import { SeriesManager } from './SeriesManager'

const refetchSeries = vi.fn()
const confirmMock = vi.fn().mockResolvedValue(true)
let seriesData: SeriesModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useSeries: () => ({ data: seriesData, loading: false, error: null, refetch: refetchSeries })
}))

vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => confirmMock
}))

function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      series: {
        create: vi
          .fn()
          .mockResolvedValue({ success: true, data: { id: 's2', name: 'new-series' } }),
        update: vi.fn().mockResolvedValue({ success: true, data: { id: 's1', name: 'renamed' } }),
        delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        ...overrides
      },
      media: {
        getEntityThumbnails: vi.fn().mockResolvedValue({ success: true, data: [] })
      }
    },
    writable: true,
    configurable: true
  })
}

beforeEach(() => {
  seriesData = [
    {
      id: 's1',
      name: 'Wonderland',
      aliases: ['Alice in Wonderland'],
      createdAt: 1700000000000,
      mediaCount: 3
    },
    { id: 's2', name: 'Neverland', aliases: [], createdAt: 1700000001000 }
  ]
  refetchSeries.mockReset()
  confirmMock.mockReset()
  confirmMock.mockResolvedValue(true)
  setApi()
})

describe('SeriesManager', () => {
  it('renders existing series', () => {
    render(<SeriesManager />)
    expect(screen.getByText('Wonderland')).toBeInTheDocument()
    expect(screen.getByText('Neverland')).toBeInTheDocument()
  })

  it('creates a new series with aliases', async () => {
    const user = userEvent.setup()
    const create = vi
      .fn()
      .mockResolvedValue({ success: true, data: { id: 's3', name: 'new-series' } })
    setApi({ create })
    render(<SeriesManager />)

    await user.type(screen.getByLabelText('Name'), 'new-series')
    await user.type(screen.getByLabelText('Aliases'), 'alt-title')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(create).toHaveBeenCalledWith({ name: 'new-series', aliases: ['alt-title'] })
    expect(refetchSeries).toHaveBeenCalled()
  })

  it('switches the panel into edit mode and pre-fills the fields', async () => {
    const user = userEvent.setup()
    render(<SeriesManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Wonderland' }))

    expect(screen.getByText('Editing "Wonderland"')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Wonderland')
    expect(screen.getByLabelText('Aliases')).toHaveValue('Alice in Wonderland')
  })

  it('saves an edited series', async () => {
    const user = userEvent.setup()
    const update = vi.fn().mockResolvedValue({ success: true, data: { id: 's1', name: 'renamed' } })
    setApi({ update })
    render(<SeriesManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Wonderland' }))
    const input = screen.getByLabelText('Name')
    await user.clear(input)
    await user.type(input, 'renamed')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith('s1', {
      name: 'renamed',
      aliases: ['Alice in Wonderland']
    })
    expect(refetchSeries).toHaveBeenCalled()
  })

  it('returns to the add-new form when editing is cancelled', async () => {
    const user = userEvent.setup()
    render(<SeriesManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Wonderland' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Add new')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('deletes a series after confirming, when it has media', async () => {
    const user = userEvent.setup()
    const del = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApi({ delete: del })
    render(<SeriesManager />)

    await user.click(screen.getByRole('button', { name: 'Delete Wonderland' }))

    expect(confirmMock).toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith('s1')
    expect(refetchSeries).toHaveBeenCalled()
  })

  it('deletes a series immediately without confirming, when it has no media', async () => {
    const user = userEvent.setup()
    const del = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApi({ delete: del })
    render(<SeriesManager />)

    await user.click(screen.getByRole('button', { name: 'Delete Neverland' }))

    expect(confirmMock).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith('s2')
    expect(refetchSeries).toHaveBeenCalled()
  })

  it('skips confirmation dialog for a parent series with direct mediaCount: 0, even though its rolled-up count is nonzero', async () => {
    const user = userEvent.setup()
    const del = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApi({ delete: del })
    seriesData = [
      {
        id: 's1',
        name: 'Parent Series',
        aliases: [],
        createdAt: 1700000000000,
        mediaCount: 0
      },
      {
        id: 's2',
        name: 'Child Series',
        aliases: [],
        createdAt: 1700000001000,
        parentId: 's1',
        mediaCount: 5
      }
    ]
    render(<SeriesManager />)

    const parentItem = screen.getByText('Parent Series').closest('li') as HTMLElement
    expect(parentItem).toHaveTextContent('5') // the displayed count is the rolled-up one
    const deleteButton = within(parentItem).getByRole('button', { name: /Delete/ })
    await user.click(deleteButton)

    expect(confirmMock).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith('s1')
    expect(refetchSeries).toHaveBeenCalled()
  })

  it('shows an empty state when there are no series', () => {
    seriesData = []
    render(<SeriesManager />)
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('disables the Add button until a name is entered', async () => {
    const user = userEvent.setup()
    render(<SeriesManager />)

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()

    await user.type(screen.getByLabelText('Name'), 'new-series')

    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('filters the list by search query', async () => {
    const user = userEvent.setup()
    render(<SeriesManager />)

    await user.type(screen.getByRole('searchbox'), 'wonder')

    expect(screen.getByText('Wonderland')).toBeInTheDocument()
    expect(screen.queryByText('Neverland')).not.toBeInTheDocument()
  })

  it('persists the chosen sort order and re-applies it on next render', async () => {
    const user = userEvent.setup()
    window.localStorage.clear()
    const { unmount } = render(<SeriesManager />)

    await user.selectOptions(screen.getByLabelText('Sort by'), 'createdAt')
    await user.click(screen.getByRole('button', { name: 'Ascending' }))

    unmount()
    render(<SeriesManager />)

    expect(screen.getByLabelText('Sort by')).toHaveValue('createdAt')
    expect(screen.getByRole('button', { name: 'Descending' })).toBeInTheDocument()
  })

  it('shows series aliases in the list', () => {
    render(<SeriesManager />)
    expect(screen.getByText('Alice in Wonderland')).toBeInTheDocument()
  })

  it('sends the chosen parent series on create', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue({ success: true, data: { id: 's3', name: 'child' } })
    setApi({ create })
    render(<SeriesManager />)

    await user.type(screen.getByLabelText('Name'), 'child')
    const [parentInput] = screen.getAllByRole('combobox')
    await user.type(parentInput, 'Wonderland')
    await user.click(await screen.findByRole('option', { name: 'Wonderland' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(create).toHaveBeenCalledWith({ name: 'child', aliases: [], parentId: 's1' })
  })

  it('pre-fills the parent series field when editing a series that has one', async () => {
    seriesData = [
      { id: 's1', name: 'Wonderland', aliases: [], createdAt: 1700000000000 },
      {
        id: 's2',
        name: 'Alice in Wonderland (1951)',
        aliases: [],
        createdAt: 1700000001000,
        parentId: 's1'
      }
    ]
    const user = userEvent.setup()
    render(<SeriesManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Alice in Wonderland (1951)' }))

    const [parentInput] = screen.getAllByRole('combobox')
    expect(parentInput).toHaveValue('Wonderland')
  })

  it("still shows a matched series' parent for context while searching, indented the same way as unfiltered", async () => {
    const user = userEvent.setup()
    seriesData = [
      { id: 's1', name: 'Honkai (series)', aliases: [], createdAt: 1700000000000, mediaCount: 1 },
      {
        id: 's2',
        name: 'Honkai: Star Rail',
        aliases: [],
        createdAt: 1700000001000,
        parentId: 's1',
        mediaCount: 5
      }
    ]
    render(<SeriesManager />)

    await user.type(screen.getByRole('searchbox'), 'Star Rail')

    expect(screen.getByText('Honkai (series)')).toBeInTheDocument()
    const childItem = screen.getByText('Honkai: Star Rail').closest('li')
    expect(childItem?.className).toContain('depth-1')
  })

  it('renders a child series indented under its parent with a rolled-up media count', () => {
    seriesData = [
      { id: 's1', name: 'Wonderland', aliases: [], createdAt: 1700000000000, mediaCount: 2 },
      {
        id: 's2',
        name: 'Alice in Wonderland (1951)',
        aliases: [],
        createdAt: 1700000001000,
        parentId: 's1',
        mediaCount: 5
      }
    ]
    render(<SeriesManager />)

    const parentItem = screen.getByText('Wonderland').closest('li')
    const childItem = screen.getByText('Alice in Wonderland (1951)').closest('li')
    expect(parentItem).toHaveTextContent('7')
    expect(childItem?.className).toContain('depth-1')
  })
})
