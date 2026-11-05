// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MediaFilters } from '@shared/models'
import { SaveFilterListDialog } from './SaveFilterListDialog'

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({ data: [{ id: 'a1', name: 'Jane' }] }),
  useTags: () => ({
    data: [
      { id: 't1', name: 'landscape' },
      { id: 't2', name: 'lewd' }
    ]
  }),
  useCharacters: () => ({ data: [{ id: 'c1', name: 'Kiana', series: [] }] }),
  useSeries: () => ({ data: [{ id: 's1', name: 'Honkai' }] }),
  useFilterLists: () => ({ data: [{ id: 'l1', name: 'Apta' }] })
}))

const create = vi.fn()

beforeEach(() => {
  create.mockReset().mockResolvedValue({ success: true, data: {} })
  Object.defineProperty(window, 'api', {
    value: { filterList: { create } },
    writable: true,
    configurable: true
  })
})

function renderDialog(filters: MediaFilters): { onClose: () => void; onSaved: () => void } {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(<SaveFilterListDialog filters={filters} onClose={onClose} onSaved={onSaved} />)
  return { onClose, onSaved }
}

const nameField = (): HTMLElement => screen.getByRole('textbox', { name: 'Name' })
const saveButton = (): HTMLElement => screen.getByRole('button', { name: 'Save' })

describe('SaveFilterListDialog', () => {
  it('saves the filters, with applied lists as includes and never inside the filters', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderDialog({
      sfw: true,
      type: 'image',
      filterListIds: ['l1'],
      limit: 60,
      offset: 60,
      pendingTagging: false
    })

    await user.type(nameField(), '  Banner ')
    await user.click(saveButton())

    expect(create).toHaveBeenCalledWith({
      name: 'Banner',
      filters: { sfw: true, type: 'image' },
      includedListIds: ['l1']
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('shows everything that will be stored', () => {
    renderDialog({
      query: 'beach',
      artistId: 'a1',
      sfw: false,
      isAiGenerated: false,
      type: 'gif',
      filterListIds: ['l1'],
      tagGroups: [['t1', '-t2']],
      characterGroups: [['c1']],
      exactCharacterIds: ['c1'],
      noSeries: true
    })

    const items = within(screen.getByRole('group', { name: 'What gets saved' }))
    for (const text of [
      'Apta',
      'beach',
      'Gif',
      'NSFW only',
      'Exclude AI',
      'Jane',
      'landscape',
      'lewd',
      'No series assigned'
    ]) {
      expect(items.getByText(text)).toBeInTheDocument()
    }
    expect(items.getByText('Kiana (only this one)')).toBeInTheDocument()
  })

  it('leaves out what the user removes, without touching the rest', async () => {
    const user = userEvent.setup()
    renderDialog({
      sfw: true,
      type: 'image',
      filterListIds: ['l1'],
      tagGroups: [['t1', '-t2']],
      characterGroups: [['c1']],
      exactCharacterIds: ['c1']
    })

    await user.click(screen.getByRole('button', { name: 'Remove Image' }))
    await user.click(screen.getByRole('button', { name: 'Remove Apta' }))
    await user.click(screen.getByRole('button', { name: 'Remove lewd' }))
    await user.click(screen.getByRole('button', { name: 'Remove Kiana (only this one)' }))
    await user.type(nameField(), 'Perfil')
    await user.click(saveButton())

    const sent = create.mock.calls[0][0]
    expect(sent.includedListIds).toEqual([])
    expect(sent.filters.sfw).toBe(true)
    expect(sent.filters.type).toBeUndefined()
    expect(sent.filters.tagGroups).toEqual([['t1']])
    expect(sent.filters.characterGroups).toBeUndefined()
    expect(sent.filters.exactCharacterIds).toBeUndefined()
  })

  it('refuses to save when everything was removed, and says why', async () => {
    const user = userEvent.setup()
    renderDialog({ sfw: true })

    await user.type(nameField(), 'Nada')
    await user.click(screen.getByRole('button', { name: 'Remove SFW only' }))
    await user.click(saveButton())

    expect(create).not.toHaveBeenCalled()
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Nothing left to save')).toBeInTheDocument()
  })

  it('shows the service error and stays open with the name kept', async () => {
    const user = userEvent.setup()
    create.mockResolvedValue({
      success: false,
      error: { message: 'A filter list named "Apta" already exists' }
    })
    const { onClose, onSaved } = renderDialog({ sfw: true })

    await user.type(nameField(), 'Apta')
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
    expect(nameField()).toHaveValue('Apta')
    expect(saveButton()).not.toHaveAttribute('aria-disabled')
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('locks its controls while saving, and a second press sends nothing', async () => {
    const user = userEvent.setup()
    create.mockReturnValue(new Promise(() => {}))
    const { onClose } = renderDialog({ sfw: true })

    await user.type(nameField(), 'Apta{Enter}')
    await user.keyboard('{Enter}{Escape}')

    expect(create).toHaveBeenCalledTimes(1)
    expect(nameField()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape when nothing is running', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog({ sfw: true })

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
