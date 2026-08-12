// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterModel, SeriesModel, TagModel } from '@shared/models'
import { BatchEditDialog } from './BatchEditDialog'

let tagsData: TagModel[] = []
let charactersData: CharacterModel[] = []
let seriesData: SeriesModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useTags: () => ({ data: tagsData, loading: false, error: null, refetch: vi.fn() }),
  useCharacters: () => ({ data: charactersData, loading: false, error: null, refetch: vi.fn() }),
  useSeries: () => ({ data: seriesData, loading: false, error: null, refetch: vi.fn() })
}))

beforeEach(() => {
  tagsData = [
    { id: 't1', name: 'sunset', createdAt: 1 },
    { id: 't2', name: 'landscape', createdAt: 2 }
  ]
  charactersData = [{ id: 'c1', name: 'Ishtar', series: [], aliases: [], createdAt: 1 }]
  seriesData = [{ id: 's1', name: 'Fate/Grand Order', aliases: [], createdAt: 1 }]
})

describe('BatchEditDialog', () => {
  it('shows the item count in the title', () => {
    render(<BatchEditDialog count={3} onApply={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Edit metadata for 3 items')).toBeInTheDocument()
  })

  it('disables Apply until at least one add/remove selection is made', async () => {
    const user = userEvent.setup()
    render(<BatchEditDialog count={1} onApply={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()

    await user.type(screen.getByRole('combobox', { name: /^Add tags/ }), 'sunset')
    await user.click(await screen.findByRole('option', { name: 'sunset' }))
    // React Aria's popover hides the rest of the page from the accessibility
    // tree (aria-hide-outside) while it's open - close it before querying
    // anything outside the combobox.
    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
  })

  it('calls onApply with the selected add/remove ids', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<BatchEditDialog count={1} onApply={onApply} onCancel={vi.fn()} />)

    await user.type(screen.getByRole('combobox', { name: /^Add tags/ }), 'sunset')
    await user.click(await screen.findByRole('option', { name: 'sunset' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(onApply).toHaveBeenCalledWith({
      addTagIds: ['t1'],
      removeTagIds: [],
      addCharacterIds: [],
      removeCharacterIds: [],
      addSeriesIds: [],
      removeSeriesIds: []
    })
  })

  it('excludes a tag from Remove options once it is selected in Add', async () => {
    const user = userEvent.setup()
    render(<BatchEditDialog count={1} onApply={vi.fn()} onCancel={vi.fn()} />)

    await user.type(screen.getByRole('combobox', { name: /^Add tags/ }), 'sunset')
    await user.click(await screen.findByRole('option', { name: 'sunset' }))
    await user.keyboard('{Escape}')

    await user.type(screen.getByRole('combobox', { name: /^Remove tags/ }), 'sun')

    expect(screen.queryByRole('option', { name: 'sunset' })).not.toBeInTheDocument()
  })

  it('calls onCancel when the Cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<BatchEditDialog count={1} onApply={vi.fn()} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })
})
