// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterModel, MediaFilters, SeriesModel, Sorting, TagModel } from '@shared/models'
import { FilterBar } from './FilterBar'

function corePanel(): HTMLElement {
  return document.querySelector('.filter-bar-core') as HTMLElement
}

let tagsData: TagModel[] = []
let charactersData: CharacterModel[] = []
let seriesData: SeriesModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useTags: () => ({ data: tagsData, loading: false, error: null, refetch: vi.fn() }),
  useCharacters: () => ({ data: charactersData, loading: false, error: null, refetch: vi.fn() }),
  useSeries: () => ({ data: seriesData, loading: false, error: null, refetch: vi.fn() })
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
  seriesData = []
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

  it('always shows the artist/tags/characters/series filters, with no collapse toggle', () => {
    renderFilterBar()

    expect(screen.getByRole('combobox', { name: /artist/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /advanced/i })).not.toBeInTheDocument()
  })

  it('adds a tag to the tags filter group and merges it into the existing filters', async () => {
    tagsData = [{ id: 't1', name: 'landscape' }]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ sfw: true })

    // Combobox order: Artist, Tags, Characters, Series. Scoped to the core
    // panel so the native Type/Sort-by <select> elements (also exposed with
    // an implicit "combobox" role) don't shift the index.
    const [, tagsCombobox] = within(corePanel()).getAllByRole('combobox')
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

  it('shows a "no character" toggle that clears character groups and sets noCharacter, atomically', async () => {
    charactersData = [{ id: 'c1', name: 'Ishtar', series: [] }]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ sfw: true, characterGroups: [['c1']] })

    await user.click(screen.getByRole('button', { name: 'No character assigned' }))

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({
      sfw: true,
      noCharacter: true,
      characterGroups: undefined
    })
  })

  it('disables the character picker while noCharacter is checked, but keeps its toggle clickable', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ noCharacter: true })

    // Combobox order: Artist, Tags, Characters, Series.
    const [, , charactersCombobox] = within(corePanel()).getAllByRole('combobox')
    expect(charactersCombobox).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'No character assigned' }))

    expect(onFiltersChange).toHaveBeenCalledWith({
      noCharacter: undefined,
      characterGroups: undefined
    })
  })

  it('adds a series to the series filter group and merges it into the existing filters', async () => {
    seriesData = [{ id: 's1', name: 'Fate/Grand Order' }]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ sfw: true })

    // Combobox order: Artist, Tags, Characters, Series.
    const [, , , seriesCombobox] = within(corePanel()).getAllByRole('combobox')
    await user.type(seriesCombobox, 'Fate')
    await user.click(await screen.findByRole('option', { name: 'Fate/Grand Order' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, seriesGroups: [['s1']] })
  })

  it('builds an OR-of-AND-groups series query, updating only the targeted group', async () => {
    seriesData = [
      { id: 's1', name: 'Fate/Grand Order' },
      { id: 's2', name: 'Fate/stay night' }
    ]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ seriesGroups: [['s1'], []] })

    const comboboxes = screen.getAllByRole('combobox', { name: /^Series/ })
    expect(comboboxes).toHaveLength(2)
    await user.type(comboboxes[1], 'Fate/stay')
    await user.click(await screen.findByRole('option', { name: 'Fate/stay night' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ seriesGroups: [['s1'], ['s2']] })
  })

  it('shows a "no series" toggle that clears series groups and sets noSeries, atomically', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderFilterBar({ seriesGroups: [['s1']] })

    await user.click(screen.getByRole('button', { name: 'No series assigned' }))

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({ seriesGroups: undefined, noSeries: true })
  })

  it('disables the series picker while noSeries is checked', () => {
    renderFilterBar({ noSeries: true })

    const [seriesCombobox] = within(corePanel()).getAllByRole('combobox', { name: /series/i })
    expect(seriesCombobox).toBeDisabled()
  })

  it('shows the linked series next to a character option', async () => {
    charactersData = [
      { id: 'c1', name: 'Ishtar', series: [{ id: 's1', name: 'Fate/Grand Order' }] }
    ]
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFilterBar()

    // Combobox order: Artist, Tags, Characters, Series.
    const [, , charactersCombobox] = within(corePanel()).getAllByRole('combobox')
    await user.type(charactersCombobox, 'Ishtar')

    expect(
      await screen.findByRole('option', { name: 'Ishtar (Fate/Grand Order)' })
    ).toBeInTheDocument()
  })

  describe('More filters popover (SFW / AI-generated)', () => {
    it('keeps the SFW/AI selects hidden until "More filters" is opened', () => {
      renderFilterBar()

      expect(screen.queryByLabelText('AI')).not.toBeInTheDocument()
    })

    it('sets isAiGenerated: true when "AI only" is selected', async () => {
      const user = userEvent.setup()
      const { onFiltersChange } = renderFilterBar({ sfw: true })

      await user.click(screen.getByRole('button', { name: /more filters/i }))
      fireEvent.change(screen.getByLabelText('AI'), { target: { value: 'ai' } })

      expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, isAiGenerated: true })
    })

    it('sets isAiGenerated: false when "Exclude AI" is selected', async () => {
      const user = userEvent.setup()
      const { onFiltersChange } = renderFilterBar({ sfw: true })

      await user.click(screen.getByRole('button', { name: /more filters/i }))
      fireEvent.change(screen.getByLabelText('AI'), { target: { value: 'notAi' } })

      expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, isAiGenerated: false })
    })

    it('clears isAiGenerated when "All" is selected again', async () => {
      const user = userEvent.setup()
      const { onFiltersChange } = renderFilterBar({ sfw: true, isAiGenerated: true })

      await user.click(screen.getByRole('button', { name: /more filters/i }))
      fireEvent.change(screen.getByLabelText('AI'), { target: { value: 'all' } })

      expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, isAiGenerated: undefined })
    })

    it('shows a badge with the count of active SFW/AI filters', () => {
      renderFilterBar({ sfw: true, isAiGenerated: false })

      expect(screen.getByRole('button', { name: /more filters/i })).toHaveTextContent('2')
    })
  })
})
