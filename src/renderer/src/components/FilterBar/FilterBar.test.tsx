// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterModel, MediaFilters, Sorting, TagModel } from '@shared/models'
import { FilterBar } from './FilterBar'

function advancedPanel(): HTMLElement {
  return document.querySelector('.filter-bar-advanced') as HTMLElement
}

let tagsData: TagModel[] = []
let charactersData: CharacterModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useTags: () => ({ data: tagsData, loading: false, error: null, refetch: vi.fn() }),
  useCharacters: () => ({ data: charactersData, loading: false, error: null, refetch: vi.fn() }),
  useSeries: () => ({ data: [], loading: false, error: null, refetch: vi.fn() })
}))

function renderFilterBar(filters: MediaFilters = {}) {
  const onFiltersChange = vi.fn()
  const onSortingChange = vi.fn()
  const sorting: Sorting = { prop: 'createdAt', desc: true }
  render(
    <FilterBar
      filters={filters}
      onFiltersChange={onFiltersChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
    />
  )
  return { onFiltersChange, onSortingChange }
}

beforeEach(() => {
  tagsData = []
  charactersData = []
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FilterBar', () => {
  it('does not call onFiltersChange on initial mount', () => {
    const { onFiltersChange } = renderFilterBar()
    vi.advanceTimersByTime(1000)
    expect(onFiltersChange).not.toHaveBeenCalled()
  })

  it('debounces the search query and merges it into the existing filters', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ sfw: true })

    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'sunset')

    expect(onFiltersChange).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)

    expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, query: 'sunset' })
  })

  it('adds a tag to the tags filter group and merges it into the existing filters', async () => {
    tagsData = [{ id: 't1', name: 'landscape' }]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ sfw: true })

    await user.click(screen.getByRole('button', { name: /advanced filters/i }))
    // react-aria combines its own <Label> with our aria-label into e.g. "Tags Tags",
    // so match positionally (within the advanced panel, after the Artist field)
    // instead of by exact accessible name.
    const [, tagsCombobox] = within(advancedPanel()).getAllByRole('combobox')
    await user.type(tagsCombobox, 'landscape')
    await user.click(await screen.findByRole('option', { name: 'landscape' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, tagGroups: [['t1']] })
  })

  it('builds an OR-of-AND-groups tags query, updating only the targeted group', async () => {
    tagsData = [
      { id: 't1', name: 'Ishtar' },
      { id: 't2', name: 'Ereshkigal' }
    ]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // an already-active tag group auto-expands Advanced Filters on mount
    const { onFiltersChange } = renderFilterBar({ tagGroups: [['t1'], []] })

    const comboboxes = screen.getAllByRole('combobox', { name: /^Tags/ })
    expect(comboboxes).toHaveLength(2)
    await user.type(comboboxes[1], 'Ereshkigal')
    await user.click(await screen.findByRole('option', { name: 'Ereshkigal' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ tagGroups: [['t1'], ['t2']] })
  })

  it('changes the sort direction when the toggle button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onSortingChange } = renderFilterBar()

    await user.click(screen.getByRole('button', { name: 'Descending' }))

    expect(onSortingChange).toHaveBeenCalledWith({ prop: 'createdAt', desc: false })
  })

  it('keeps advanced filters (Artist/Tags/Characters) collapsed by default', () => {
    renderFilterBar()

    expect(screen.queryByRole('combobox', { name: /artist/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /advanced filters/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('expands advanced filters when the toggle is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFilterBar()

    await user.click(screen.getByRole('button', { name: /advanced filters/i }))

    expect(screen.getByRole('combobox', { name: /artist/i })).toBeInTheDocument()
  })

  it('auto-expands advanced filters when an advanced filter is already active', () => {
    renderFilterBar({ artistId: 'a1' })

    expect(screen.getByRole('combobox', { name: /artist/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /advanced filters/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('shows a badge with the count of active advanced filters', () => {
    renderFilterBar({ artistId: 'a1', tagGroups: [['t1']] })

    expect(screen.getByRole('button', { name: /advanced filters/i })).toHaveTextContent('2')
  })

  it('counts noCharacter and noSeries as active advanced filters', () => {
    renderFilterBar({ noCharacter: true, noSeries: true })

    expect(screen.getByRole('button', { name: /advanced filters/i })).toHaveTextContent('2')
  })

  it('shows a "no character" checkbox that clears character groups and sets noCharacter, atomically', async () => {
    charactersData = [{ id: 'c1', name: 'Ishtar', series: [] }]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ sfw: true, characterGroups: [['c1']] })

    await user.click(screen.getByRole('checkbox', { name: /no character assigned/i }))

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({
      sfw: true,
      noCharacter: true,
      characterGroups: undefined
    })
  })

  it('disables the character picker while noCharacter is checked', () => {
    renderFilterBar({ noCharacter: true })

    // Combobox order in the advanced panel: Artist, Tags, Characters, Series.
    const [, , charactersCombobox] = within(advancedPanel()).getAllByRole('combobox')
    expect(charactersCombobox).toBeDisabled()
  })

  it('shows a "no series" checkbox that clears seriesIds and sets noSeries, atomically', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ seriesIds: ['s1'] })

    await user.click(screen.getByRole('checkbox', { name: /no series assigned/i }))

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({ seriesIds: undefined, noSeries: true })
  })

  it('disables the series picker and operator toggle while noSeries is checked', () => {
    renderFilterBar({ noSeries: true })

    const [seriesCombobox] = within(advancedPanel()).getAllByRole('combobox', { name: /series/i })
    expect(seriesCombobox).toBeDisabled()
    expect(screen.getByRole('button', { name: /any \(or\)/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /all \(and\)/i })).toBeDisabled()
  })

  it('toggles the series AND/OR operator', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ seriesIds: ['s1', 's2'] })

    const andButtons = screen.getAllByRole('button', { name: /all \(and\)/i })
    await user.click(andButtons[andButtons.length - 1])

    expect(onFiltersChange).toHaveBeenCalledWith({
      seriesIds: ['s1', 's2'],
      seriesOperator: 'AND'
    })
  })

  it('counts an active series filter in the advanced filters badge', () => {
    renderFilterBar({ seriesIds: ['s1'] })

    expect(screen.getByRole('button', { name: /advanced filters/i })).toHaveTextContent('1')
  })

  it('shows the linked series next to a character option', async () => {
    charactersData = [{ id: 'c1', name: 'Ishtar', series: [{ id: 's1', name: 'Fate/Grand Order' }] }]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFilterBar()

    await user.click(screen.getByRole('button', { name: /advanced filters/i }))
    // Combobox order in the advanced panel: Artist, Tags, Characters, Series.
    const [, , charactersCombobox] = within(advancedPanel()).getAllByRole('combobox')
    await user.type(charactersCombobox, 'Ishtar')

    expect(
      await screen.findByRole('option', { name: 'Ishtar (Fate/Grand Order)' })
    ).toBeInTheDocument()
  })

  it('sets isAiGenerated: true when "AI only" is selected', async () => {
    const { onFiltersChange } = renderFilterBar({ sfw: true })

    fireEvent.change(screen.getByLabelText('AI'), { target: { value: 'ai' } })

    expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, isAiGenerated: true })
  })

  it('sets isAiGenerated: false when "Exclude AI" is selected', async () => {
    const { onFiltersChange } = renderFilterBar({ sfw: true })

    fireEvent.change(screen.getByLabelText('AI'), { target: { value: 'notAi' } })

    expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, isAiGenerated: false })
  })

  it('clears isAiGenerated when "All" is selected again', async () => {
    const { onFiltersChange } = renderFilterBar({ sfw: true, isAiGenerated: true })

    fireEvent.change(screen.getByLabelText('AI'), { target: { value: 'all' } })

    expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, isAiGenerated: undefined })
  })
})
