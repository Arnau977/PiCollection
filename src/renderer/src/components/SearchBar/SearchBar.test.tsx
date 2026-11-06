// @vitest-environment jsdom
import { StrictMode } from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  ArtistModel,
  CharacterModel,
  FilterListModel,
  MediaFilters,
  SeriesModel,
  TagModel
} from '@shared/models'
import { SearchBar } from './SearchBar'

const artists: ArtistModel[] = [{ id: 'a1', name: 'Jane Doe' }]
const tags: TagModel[] = [
  { id: 't1', name: 'landscape' },
  { id: 't2', name: 'lantern' }
]
const characters: CharacterModel[] = [
  { id: 'c1', name: 'Alice', series: [{ id: 's2', name: 'Wonderland' }] },
  { id: 'c2', name: 'Cheshire Cat', series: [] }
]
const series: SeriesModel[] = [
  { id: 's1', name: 'Wonder Land' },
  { id: 's3', name: 'Wonderland Party' }
]

const filterLists = [
  { id: 'l1', name: 'Perfil' },
  { id: 'l2', name: 'Banner' }
] as FilterListModel[]

function renderSearchBar(filters: MediaFilters = {}) {
  const onFiltersChange = vi.fn()
  render(
    <SearchBar
      filters={filters}
      onFiltersChange={onFiltersChange}
      artists={artists}
      tags={tags}
      characters={characters}
      series={series}
      filterLists={filterLists}
    />
  )
  return { onFiltersChange }
}

describe('SearchBar on mount', () => {
  // Reapplying filters sends the gallery to page 1, so coming back from a
  // media would lose the page. StrictMode runs mount effects twice.
  it('leaves the filters alone until the text changes', async () => {
    const onFiltersChange = vi.fn()
    render(
      <StrictMode>
        <SearchBar
          filters={{ query: 'a' }}
          onFiltersChange={onFiltersChange}
          artists={[]}
          tags={[]}
          characters={[]}
          series={[]}
          filterLists={[]}
        />
      </StrictMode>
    )

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onFiltersChange).not.toHaveBeenCalled()
  })
})

function searchInput(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Search' })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

describe('SearchBar filter lists', () => {
  const user = (): ReturnType<typeof userEvent.setup> =>
    userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  it('applies a list on top of the other filters, removing the typed word', async () => {
    const u = user()
    const { onFiltersChange } = renderSearchBar({ sfw: true, type: 'gif', filterListIds: ['l2'] })

    await u.type(searchInput(), 'beach perf')
    await u.click(screen.getByRole('option', { name: /Perfil/ }))

    expect(onFiltersChange).toHaveBeenLastCalledWith({
      sfw: true,
      type: 'gif',
      filterListIds: ['l2', 'l1'],
      query: 'beach'
    })
    expect(searchInput()).toHaveValue('beach ')
  })

  it('does not offer a list that is already applied', async () => {
    const u = user()
    renderSearchBar({ filterListIds: ['l1'] })

    await u.type(searchInput(), 'perf')

    expect(screen.queryByRole('option', { name: /Perfil/ })).not.toBeInTheDocument()
  })

  it('does not offer a list after a minus, since a list cannot be excluded', async () => {
    const u = user()
    renderSearchBar()

    await u.type(searchInput(), '-perf')

    expect(screen.queryByRole('option', { name: /Perfil/ })).not.toBeInTheDocument()
  })

  it('shows the lists when the empty box gets focus, and hides them when it loses it', async () => {
    const u = user()
    renderSearchBar()

    await u.click(searchInput())
    expect(screen.getAllByRole('option')).toHaveLength(2)

    await u.tab()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('applies a browsed list with a click', async () => {
    const u = user()
    const { onFiltersChange } = renderSearchBar()

    await u.click(searchInput())
    await u.click(screen.getByRole('option', { name: /Perfil/ }))

    expect(onFiltersChange).toHaveBeenLastCalledWith({ filterListIds: ['l1'] })
  })

  it('lets Tab leave the empty box until the user arrows onto a list', async () => {
    const u = user()
    const { onFiltersChange } = renderSearchBar()

    searchInput().focus()
    await u.tab()
    expect(onFiltersChange).not.toHaveBeenCalled()

    searchInput().focus()
    await u.keyboard('{ArrowDown}{Tab}')
    expect(onFiltersChange).toHaveBeenLastCalledWith({ filterListIds: ['l1'] })
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SearchBar', () => {
  it('does not call onFiltersChange on initial mount', () => {
    const { onFiltersChange } = renderSearchBar()
    vi.advanceTimersByTime(1000)
    expect(onFiltersChange).not.toHaveBeenCalled()
  })

  it('shows the existing query when one is already active', () => {
    renderSearchBar({ query: '(a OR b) -c' })
    expect(searchInput()).toHaveValue('(a OR b) -c')
  })

  it('debounces the typed expression into the query filter', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar({ sfw: true })

    await user.type(searchInput(), '(a OR b) -c')

    expect(onFiltersChange).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)

    expect(onFiltersChange).toHaveBeenCalledWith({ sfw: true, query: '(a OR b) -c' })
  })

  it('clears the query filter when the box is emptied', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar({ query: 'a' })

    await user.clear(searchInput())
    await vi.advanceTimersByTimeAsync(300)

    expect(onFiltersChange).toHaveBeenCalledWith({ query: undefined })
  })

  it('does not render entity chips any more', async () => {
    const { container } = render(
      <SearchBar
        filters={{ query: 'landscape' }}
        onFiltersChange={vi.fn()}
        artists={artists}
        tags={tags}
        characters={characters}
        series={series}
        filterLists={[]}
      />
    )

    expect(container.querySelector('.search-chip')).not.toBeInTheDocument()
  })

  it('suggests tags, characters, series and artists for the word being typed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), 'lan')

    expect(await screen.findByRole('option', { name: /landscape/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /lantern/ })).toBeInTheDocument()
  })

  it('suggests the AI keyword while typing "ai"', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), 'ai')

    expect(await screen.findByRole('option', { name: /AI generated/ })).toBeInTheDocument()
  })

  it('inserts the bare "ai" keyword when the AI suggestion is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), 'ai')
    await user.click(await screen.findByRole('option', { name: /AI generated/ }))

    expect(searchInput()).toHaveValue('ai ')
  })

  it('suggests excluding AI and keeps the leading minus when negated', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), '-ai')
    expect(await screen.findByRole('option', { name: /Not AI generated/ })).toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: /Not AI generated/ }))
    expect(searchInput()).toHaveValue('-ai ')
  })

  it('completes the word being typed when a suggestion is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), 'lands')
    await user.click(await screen.findByRole('option', { name: /landscape/ }))

    expect(searchInput()).toHaveValue('landscape ')
  })

  it('only completes the last word, leaving earlier terms untouched', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), 'sunset lands')
    await user.click(await screen.findByRole('option', { name: /landscape/ }))

    expect(searchInput()).toHaveValue('sunset landscape ')
  })

  it('keeps a leading minus when completing a negated term', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), '-lands')
    await user.click(await screen.findByRole('option', { name: /landscape/ }))

    expect(searchInput()).toHaveValue('-landscape ')
  })

  it('quotes a completed suggestion that contains spaces', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), 'Jane')
    await user.click(await screen.findByRole('option', { name: /Jane Doe/ }))

    expect(searchInput()).toHaveValue('"Jane Doe" ')
  })

  it('completes a term typed right after an opening parenthesis', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), '(lands')
    await user.click(await screen.findByRole('option', { name: /landscape/ }))

    expect(searchInput()).toHaveValue('(landscape ')
  })

  it('does not suggest anything for an empty box', () => {
    renderSearchBar()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('hides the suggestions on Escape', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), 'lan')
    expect(await screen.findByRole('option', { name: /landscape/ })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('completes the highlighted suggestion with the keyboard', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), 'lan')
    await screen.findByRole('option', { name: /landscape/ })
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Tab}')

    expect(searchInput()).toHaveValue('lantern ')
  })

  it('explains the query syntax in a tooltip', () => {
    renderSearchBar()
    expect(screen.getByLabelText(/a space means and/i)).toBeInTheDocument()
  })

  it('shows the linked series next to a character suggestion', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSearchBar()

    await user.type(searchInput(), 'Alic')

    expect(await screen.findByRole('option', { name: /Alice \(Wonderland\)/ })).toBeInTheDocument()
  })

  it('adds the character to characterGroups instead of the query text when a suggestion is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar()

    await user.type(searchInput(), 'Alic')
    await user.click(await screen.findByRole('option', { name: /Alice \(Wonderland\)/ }))

    expect(onFiltersChange).toHaveBeenCalledWith({
      query: undefined,
      characterGroups: [['c1']]
    })
    expect(searchInput()).toHaveValue('')
  })

  it('leaves earlier terms in the query when completing a character suggestion', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar()

    await user.type(searchInput(), 'sunset Alic')
    await user.click(await screen.findByRole('option', { name: /Alice \(Wonderland\)/ }))

    expect(searchInput()).toHaveValue('sunset ')
    expect(onFiltersChange).toHaveBeenCalledWith({
      query: 'sunset',
      characterGroups: [['c1']]
    })
  })

  it('appends a second, different character to the same group', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar({ characterGroups: [['c1']] })

    await user.type(searchInput(), 'Cheshire')
    await user.click(await screen.findByRole('option', { name: /Cheshire Cat/ }))

    expect(onFiltersChange).toHaveBeenCalledWith({
      query: undefined,
      characterGroups: [['c1', 'c2']]
    })
  })

  it('does not duplicate a character already in the group', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar({ characterGroups: [['c1']] })

    await user.type(searchInput(), 'Alic')
    await user.click(await screen.findByRole('option', { name: /Alice \(Wonderland\)/ }))

    expect(onFiltersChange).toHaveBeenCalledWith({
      query: undefined,
      characterGroups: [['c1']]
    })
  })

  it('clears noCharacter when a character suggestion is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar({ noCharacter: true })

    await user.type(searchInput(), 'Alic')
    await user.click(await screen.findByRole('option', { name: /Alice \(Wonderland\)/ }))

    expect(onFiltersChange).toHaveBeenCalledWith({
      query: undefined,
      characterGroups: [['c1']],
      noCharacter: undefined
    })
  })

  it('adds the series to seriesGroups instead of the query text when a suggestion is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar()

    await user.type(searchInput(), 'Wonder')
    await user.click(await screen.findByRole('option', { name: /Series.*Wonder Land/ }))

    expect(onFiltersChange).toHaveBeenCalledWith({
      query: undefined,
      seriesGroups: [['s1']]
    })
    expect(searchInput()).toHaveValue('')
  })

  it('appends a second, different series to the same group', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar({ seriesGroups: [['s1']] })

    await user.type(searchInput(), 'Party')
    await user.click(await screen.findByRole('option', { name: /Series.*Wonderland Party/ }))

    expect(onFiltersChange).toHaveBeenCalledWith({
      query: undefined,
      seriesGroups: [['s1', 's3']]
    })
  })

  it('clears noSeries when a series suggestion is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange } = renderSearchBar({ noSeries: true })

    await user.type(searchInput(), 'Wonder')
    await user.click(await screen.findByRole('option', { name: /Series.*Wonder Land/ }))

    expect(onFiltersChange).toHaveBeenCalledWith({
      query: undefined,
      seriesGroups: [['s1']],
      noSeries: undefined
    })
  })
})

describe('SearchBar in step with the filters', () => {
  function renderControlled(filters: MediaFilters) {
    const onFiltersChange = vi.fn()
    const bar = (current: MediaFilters): JSX.Element => (
      <SearchBar
        filters={current}
        onFiltersChange={onFiltersChange}
        artists={artists}
        tags={tags}
        characters={characters}
        series={series}
        filterLists={filterLists}
      />
    )
    const { rerender } = render(bar(filters))
    return { onFiltersChange, setFilters: (next: MediaFilters) => rerender(bar(next)) }
  }

  it('empties the box when the filters are cleared elsewhere', async () => {
    const { onFiltersChange, setFilters } = renderControlled({ query: 'smile' })

    setFilters({})
    await vi.advanceTimersByTimeAsync(300)

    expect(searchInput()).toHaveValue('')
    expect(onFiltersChange).not.toHaveBeenCalled()
  })

  it('shows the text of a list opened for editing, so typing adds to it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange, setFilters } = renderControlled({})

    setFilters({ query: 'smile' })
    await user.type(searchInput(), ' blush')
    await vi.advanceTimersByTimeAsync(300)

    expect(onFiltersChange).toHaveBeenLastCalledWith({ query: 'smile blush' })
  })

  it('keeps what is being typed when its own earlier text comes back', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { onFiltersChange, setFilters } = renderControlled({})

    await user.type(searchInput(), 'ab')
    await vi.advanceTimersByTimeAsync(300)
    await user.keyboard('c ')
    setFilters(onFiltersChange.mock.lastCall![0])

    expect(searchInput()).toHaveValue('abc ')
  })

  it('leaves a saved query with stray spaces alone', async () => {
    const { onFiltersChange } = renderControlled({ query: ' smile ' })

    await vi.advanceTimersByTimeAsync(300)

    expect(onFiltersChange).not.toHaveBeenCalled()
  })

  it('closes the suggestions on clicking away, and they come back with the box', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderControlled({})

    await user.type(searchInput(), 'lan')
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)

    await user.click(document.body)
    expect(screen.queryByRole('option')).not.toBeInTheDocument()

    await user.click(searchInput())
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
  })
})
