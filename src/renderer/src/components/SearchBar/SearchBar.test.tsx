// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  ArtistModel,
  CharacterModel,
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
const series: SeriesModel[] = [{ id: 's1', name: 'Wonder Land' }]

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
    />
  )
  return { onFiltersChange }
}

function searchInput(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Search' })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
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

    await user.type(searchInput(), 'Wonder')
    await user.click(await screen.findByRole('option', { name: /Wonder Land/ }))

    expect(searchInput()).toHaveValue('"Wonder Land" ')
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
})
