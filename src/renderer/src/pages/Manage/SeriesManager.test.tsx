// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SeriesModel } from '@shared/models'
import { SeriesManager } from './SeriesManager'

const refetchSeries = vi.fn()
let seriesData: SeriesModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useSeries: () => ({ data: seriesData, loading: false, error: null, refetch: refetchSeries })
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
        getFiltered: vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } })
      }
    },
    writable: true,
    configurable: true
  })
}

beforeEach(() => {
  seriesData = [
    { id: 's1', name: 'Wonderland', aliases: ['Alice in Wonderland'], createdAt: 1700000000000 },
    { id: 's2', name: 'Neverland', aliases: [], createdAt: 1700000001000 }
  ]
  refetchSeries.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
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

  it('deletes a series after confirming', async () => {
    const user = userEvent.setup()
    const del = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApi({ delete: del })
    render(<SeriesManager />)

    await user.click(screen.getByRole('button', { name: 'Delete Wonderland' }))

    expect(window.confirm).toHaveBeenCalled()
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
})
