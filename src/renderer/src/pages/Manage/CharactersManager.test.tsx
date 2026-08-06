// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterModel, SeriesModel } from '@shared/models'
import { CharactersManager } from './CharactersManager'

const refetchCharacters = vi.fn()
const refetchSeries = vi.fn()
let charactersData: CharacterModel[] = []
let seriesData: SeriesModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useCharacters: () => ({
    data: charactersData,
    loading: false,
    error: null,
    refetch: refetchCharacters
  }),
  useSeries: () => ({ data: seriesData, loading: false, error: null, refetch: refetchSeries })
}))

function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      character: {
        create: vi.fn().mockResolvedValue({ success: true, data: {} }),
        update: vi.fn().mockResolvedValue({ success: true, data: {} }),
        delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        ...overrides
      },
      series: {
        create: vi.fn().mockResolvedValue({ success: true, data: { id: 's2', name: 'Show A' } })
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
  charactersData = [
    {
      id: 'c1',
      name: 'Alice',
      series: [{ id: 's1', name: 'Wonderland', createdAt: 1700000000000 }],
      aliases: ['Ali'],
      createdAt: 1700000000000
    },
    {
      id: 'c2',
      name: 'Peter Pan',
      series: [],
      aliases: [],
      createdAt: 1700000001000
    }
  ]
  seriesData = [{ id: 's1', name: 'Wonderland', createdAt: 1700000000000 }]
  refetchCharacters.mockReset()
  refetchSeries.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  setApi()
})

describe('CharactersManager', () => {
  it('renders existing characters with their series', () => {
    render(<CharactersManager />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    // 'Wonderland' also appears as an <option> in the series filter select added in
    // this task, so scope the match to the list item's series-meta span.
    expect(screen.getByText('Wonderland', { selector: '.manage-item-meta' })).toBeInTheDocument()
  })

  it('creates a new character with a selected series and comma-separated aliases', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue({ success: true, data: {} })
    setApi({ create })
    render(<CharactersManager />)

    await user.type(screen.getByLabelText('Name'), 'Bob')

    const [seriesInput] = screen.getAllByRole('combobox')
    await user.type(seriesInput, 'Wonderland')
    await user.click(await screen.findByRole('option', { name: 'Wonderland' }))

    await user.type(screen.getByLabelText('Aliases'), 'Bobby')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(create).toHaveBeenCalledWith({
      name: 'Bob',
      seriesIds: ['s1'],
      aliases: ['Bobby']
    })
    expect(refetchCharacters).toHaveBeenCalled()
  })

  it('does not offer inline series creation from the character form', async () => {
    const user = userEvent.setup()
    const seriesCreate = vi.fn()
    Object.defineProperty(window, 'api', {
      value: {
        character: { create: vi.fn().mockResolvedValue({ success: true, data: {} }) },
        series: { create: seriesCreate },
        media: {
          getFiltered: vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } })
        }
      },
      writable: true,
      configurable: true
    })
    render(<CharactersManager />)

    const [seriesInput] = screen.getAllByRole('combobox')
    await user.type(seriesInput, 'Show A')

    expect(screen.queryByText('Create "Show A"')).not.toBeInTheDocument()
    expect(seriesCreate).not.toHaveBeenCalled()
  })

  it('edits a character, preserving its existing series selection', async () => {
    const user = userEvent.setup()
    const update = vi.fn().mockResolvedValue({ success: true, data: {} })
    setApi({ update })
    render(<CharactersManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Alice' }))
    const nameInput = screen.getByDisplayValue('Alice')
    await user.clear(nameInput)
    await user.type(nameInput, 'Alicia')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith('c1', {
      name: 'Alicia',
      seriesIds: ['s1'],
      aliases: ['Ali']
    })
    expect(refetchCharacters).toHaveBeenCalled()
  })

  it('shows the editing panel title with the character being edited', async () => {
    const user = userEvent.setup()
    render(<CharactersManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Alice' }))

    expect(screen.getByText('Editing "Alice"')).toBeInTheDocument()
  })

  it('cancels editing without saving', async () => {
    const user = userEvent.setup()
    render(<CharactersManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Alice' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Edit Alice' })).toBeInTheDocument()
    expect(screen.getByText('Add new')).toBeInTheDocument()
  })

  it('deletes a character after confirming', async () => {
    const user = userEvent.setup()
    const del = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApi({ delete: del })
    render(<CharactersManager />)

    await user.click(screen.getByRole('button', { name: 'Delete Alice' }))

    expect(del).toHaveBeenCalledWith('c1')
    expect(refetchCharacters).toHaveBeenCalled()
  })

  it('shows an empty state when there are no characters', () => {
    charactersData = []
    render(<CharactersManager />)
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('disables the Add button until a name is entered', async () => {
    const user = userEvent.setup()
    render(<CharactersManager />)

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()

    await user.type(screen.getByLabelText('Name'), 'Bob')

    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('filters the list by search query', async () => {
    const user = userEvent.setup()
    render(<CharactersManager />)

    await user.type(screen.getByRole('searchbox'), 'ali')

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Peter Pan')).not.toBeInTheDocument()
  })

  it('persists the chosen sort order and re-applies it on next render', async () => {
    const user = userEvent.setup()
    window.localStorage.clear()
    const { unmount } = render(<CharactersManager />)

    await user.selectOptions(screen.getByLabelText('Sort by'), 'createdAt')
    await user.click(screen.getByRole('button', { name: 'Ascending' }))

    unmount()
    render(<CharactersManager />)

    expect(screen.getByLabelText('Sort by')).toHaveValue('createdAt')
    expect(screen.getByRole('button', { name: 'Descending' })).toBeInTheDocument()
  })

  it('filters the list to characters linked to the selected series', async () => {
    const user = userEvent.setup()
    render(<CharactersManager />)

    // The add/edit form's MultiSelectAutocomplete series picker also resolves to an
    // accessible name of exactly "Series" for its combobox input and hidden
    // "Show suggestions" button (react-aria labelledby quirk), so scope to the
    // plain <select> this task adds for the filter.
    await user.selectOptions(screen.getByLabelText('Series', { selector: 'select' }), 's1')

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Peter Pan')).not.toBeInTheDocument()
  })

  it('shows character aliases in the list', () => {
    render(<CharactersManager />)
    expect(screen.getByText('Ali')).toBeInTheDocument()
  })

  it('shows each character media count, compactly formatted', () => {
    charactersData = [
      { id: 'c1', name: 'Alice', series: [], aliases: [], createdAt: 1700000000000, mediaCount: 29000 },
      { id: 'c2', name: 'Peter Pan', series: [], aliases: [], createdAt: 1700000001000, mediaCount: 0 }
    ]
    render(<CharactersManager />)

    const aliceItem = screen.getByText('Alice').closest('li')
    const peterItem = screen.getByText('Peter Pan').closest('li')
    expect(aliceItem).toHaveTextContent('29k')
    expect(peterItem).toHaveTextContent('0')
  })
})
