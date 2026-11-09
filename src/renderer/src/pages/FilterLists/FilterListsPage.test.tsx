// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { FilterListModel } from '@shared/models'
import { readGallerySession, resetGallerySession } from '../../hooks/useGallerySession'
import FilterListsPage from './FilterListsPage'

const list = (overrides: Partial<FilterListModel>): FilterListModel => ({
  id: 'x',
  name: 'x',
  filters: {},
  includedListIds: [],
  hasMissingEntities: false,
  createdAt: 1,
  updatedAt: 1,
  ...overrides
})

let lists: FilterListModel[] = []

const entity = (data: unknown[]): unknown => ({
  data,
  loading: false,
  error: null,
  refetch: vi.fn()
})

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => entity([]),
  useTags: () => entity([{ id: 't1', name: 'lewd' }]),
  useCharacters: () => entity([]),
  useSeries: () => entity([]),
  useFilterLists: () => entity(lists)
}))

const confirmMock = vi.fn().mockResolvedValue(true)

vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => confirmMock
}))

const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()

beforeEach(() => {
  resetGallerySession()
  confirmMock.mockClear()
  lists = [
    list({ id: 'apta', name: 'Apta', filters: { sfw: true, tagGroups: [['-t1']] } }),
    list({ id: 'perfil', name: 'Perfil', filters: { type: ['image'] }, includedListIds: ['apta'] })
  ]
  create.mockReset().mockResolvedValue({ success: true, data: { id: 'new' } })
  update.mockReset().mockResolvedValue({ success: true, data: { id: 'perfil' } })
  remove.mockReset().mockResolvedValue({ success: true })
  Object.defineProperty(window, 'api', {
    value: { filterList: { create, update, delete: remove } },
    writable: true,
    configurable: true
  })
  Element.prototype.scrollIntoView = vi.fn()
})

function renderPage(): void {
  render(
    <MemoryRouter>
      <FilterListsPage />
    </MemoryRouter>
  )
}

const nameField = (): HTMLElement => screen.getByRole('textbox', { name: 'Name' })
const saveButton = (): HTMLElement => screen.getByRole('button', { name: 'Save' })

describe('FilterListsPage', () => {
  it('summarizes each list in one line', () => {
    renderPage()

    expect(screen.getByText('SFW only · without lewd')).toBeInTheDocument()
    expect(screen.getByText('includes Apta · Image')).toBeInTheDocument()
  })

  it('saves a new name, keeping everything else', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Edit Perfil' }))
    await user.clear(nameField())
    await user.type(nameField(), 'Avatar')
    await user.click(saveButton())

    expect(update).toHaveBeenCalledWith('perfil', {
      name: 'Avatar',
      filters: { type: ['image'] },
      includedListIds: ['apta']
    })
  })

  it('saves with an include removed', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Edit Perfil' }))
    await user.click(screen.getByRole('button', { name: 'Remove Apta' }))
    await user.click(saveButton())

    expect(update.mock.calls[0][1].includedListIds).toEqual([])
  })

  it('shows the error a save comes back with and keeps the edit open', async () => {
    const user = userEvent.setup()
    update.mockResolvedValue({
      success: false,
      error: { message: 'A filter list cannot include itself' }
    })
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Edit Perfil' }))
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('cannot include itself')
    expect(nameField()).toHaveValue('Perfil')
  })

  it('creates a list from scratch, once it has something to keep', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(nameField(), 'Gifs')
    await user.click(saveButton())
    expect(create).not.toHaveBeenCalled()
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true')

    await user.click(screen.getByRole('checkbox', { name: 'Animated' }))
    await user.click(saveButton())

    expect(create).toHaveBeenCalledWith({
      name: 'Gifs',
      filters: { type: ['gif'] },
      includedListIds: []
    })
    await waitFor(() => expect(nameField()).toHaveValue(''))
  })

  it('names the lists that stop a delete, and leaves the list there', async () => {
    const user = userEvent.setup()
    remove.mockResolvedValue({
      success: false,
      error: { message: 'This filter list is included in: Perfil' }
    })
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Delete Apta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('included in: Perfil')
    expect(screen.getByRole('button', { name: 'Edit Apta' })).toBeInTheDocument()
  })

  it('asks before deleting', async () => {
    const user = userEvent.setup()
    confirmMock.mockResolvedValueOnce(false)
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Delete Apta' }))

    expect(confirmMock).toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('warns about a lost filter, and saving leaves it out', async () => {
    const user = userEvent.setup()
    lists = [
      list({
        id: 'perfil',
        name: 'Perfil',
        filters: { type: ['image'], tagGroups: [['-deleted'], ['t1']] },
        hasMissingEntities: true
      })
    ]
    renderPage()

    const row = screen.getByText('Perfil').closest('li') as HTMLElement
    expect(within(row).getByText('Lost a filter')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit Perfil' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saving removes it')
    await user.click(saveButton())

    expect(update.mock.calls[0][1].filters).toEqual({ type: ['image'], tagGroups: [['t1']] })
  })

  it('counts what is left once a lost filter goes, so a list with nothing left cannot save', async () => {
    const user = userEvent.setup()
    lists = [
      list({
        id: 'solo',
        name: 'Solo',
        filters: { tagGroups: [['-deleted']] },
        hasMissingEntities: true
      })
    ]
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Edit Solo' }))
    await user.click(saveButton())

    expect(update).not.toHaveBeenCalled()
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true')
    expect(saveButton()).toHaveAttribute('title', 'Nothing left to save')
  })

  it('points at the included list when that is the one that lost a filter', () => {
    lists = [
      list({ id: 'apta', name: 'Apta', filters: { sfw: true }, hasMissingEntities: true }),
      list({ id: 'perfil', name: 'Perfil', includedListIds: ['apta'] })
    ]
    renderPage()

    const row = screen.getByText('Perfil').closest('li') as HTMLElement
    expect(within(row).getByText('A list inside it lost a filter')).toBeInTheDocument()
  })

  it('does not save when Enter is pressed in a picker', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Edit Perfil' }))
    await user.type(screen.getByRole('combobox', { name: /Tags/ }), 'no such tag{Enter}')

    expect(update).not.toHaveBeenCalled()
    expect(nameField()).toHaveValue('Perfil')
  })

  it('still saves on Enter in the name field', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Edit Perfil' }))
    await user.type(nameField(), '{Enter}')

    expect(update).toHaveBeenCalled()
  })

  it('opens a list in the gallery', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Show Apta in the gallery' }))

    expect(readGallerySession()?.filters.filterListIds).toEqual(['apta'])
  })

  it('opens a list for editing in the gallery', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Edit Apta in the gallery' }))

    const session = readGallerySession()
    expect(session?.listEdit).toMatchObject({ id: 'apta', before: { filterListIds: ['apta'] } })
    expect(session?.filters.filterListIds).toBeUndefined()
  })
})
