// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TagModel } from '@shared/models'
import { TagsManager } from './TagsManager'

const refetchTags = vi.fn()
let tagsData: TagModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useTags: () => ({ data: tagsData, loading: false, error: null, refetch: refetchTags })
}))

const confirmMock = vi.fn().mockResolvedValue(true)

vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => confirmMock
}))

function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      tag: {
        create: vi.fn().mockResolvedValue({ success: true, data: { id: 't2', name: 'new-tag' } }),
        update: vi.fn().mockResolvedValue({ success: true, data: { id: 't1', name: 'renamed' } }),
        delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        ...overrides
      },
      media: {
        getEntityThumbnails: vi.fn().mockResolvedValue({ success: true, data: [] })
      },
      danbooru: {
        autocompleteTags: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getCredentials: vi
          .fn()
          .mockResolvedValue({ success: true, data: { username: 'arnau', apiKey: 'abc123' } })
      },
      tagWiki: {
        lookup: vi.fn().mockResolvedValue({ success: true, data: null })
      }
    },
    writable: true,
    configurable: true
  })
}

beforeEach(() => {
  tagsData = [
    { id: 't1', name: 'landscape', aliases: ['scenery'], createdAt: 1700000000000, mediaCount: 3 },
    { id: 't2', name: 'portrait', aliases: [], createdAt: 1700000001000 }
  ]
  refetchTags.mockReset()
  confirmMock.mockReset()
  confirmMock.mockResolvedValue(true)
  setApi()
})

describe('TagsManager', () => {
  it('renders existing tags', () => {
    render(<TagsManager />)
    expect(screen.getByText('landscape')).toBeInTheDocument()
    expect(screen.getByText('portrait')).toBeInTheDocument()
  })

  it('shows "Add new" in the form panel by default', () => {
    render(<TagsManager />)
    expect(screen.getByText('Add new')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('creates a new tag', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue({ success: true, data: { id: 't3', name: 'new-tag' } })
    setApi({ create })
    render(<TagsManager />)

    await user.type(screen.getByLabelText('Name'), 'new-tag')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(create).toHaveBeenCalledWith({ name: 'new-tag', aliases: [] })
    expect(refetchTags).toHaveBeenCalled()
  })

  it('creates a new tag with aliases', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue({ success: true, data: { id: 't3', name: 'new-tag' } })
    setApi({ create })
    render(<TagsManager />)

    await user.type(screen.getByLabelText('Name'), 'new-tag')
    await user.type(screen.getByLabelText('Aliases'), 'synonym')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(create).toHaveBeenCalledWith({ name: 'new-tag', aliases: ['synonym'] })
    expect(refetchTags).toHaveBeenCalled()
  })

  it('switches the panel into edit mode and pre-fills the fields', async () => {
    const user = userEvent.setup()
    render(<TagsManager />)

    await user.click(screen.getByRole('button', { name: 'Edit landscape' }))

    expect(screen.getByText('Editing "landscape"')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('landscape')
    expect(screen.getByLabelText('Aliases')).toHaveValue('scenery')
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('saves an edited tag name', async () => {
    const user = userEvent.setup()
    const update = vi.fn().mockResolvedValue({ success: true, data: { id: 't1', name: 'renamed' } })
    setApi({ update })
    render(<TagsManager />)

    await user.click(screen.getByRole('button', { name: 'Edit landscape' }))
    const input = screen.getByLabelText('Name')
    await user.clear(input)
    await user.type(input, 'renamed')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith('t1', { name: 'renamed', aliases: ['scenery'] })
    expect(refetchTags).toHaveBeenCalled()
  })

  it('shows tag aliases in the list', () => {
    render(<TagsManager />)
    expect(screen.getByText('scenery')).toBeInTheDocument()
  })

  it('filters the list by alias match', async () => {
    const user = userEvent.setup()
    render(<TagsManager />)

    await user.type(screen.getByRole('searchbox'), 'scenery')

    await waitFor(() => {
      expect(screen.getByText('landscape')).toBeInTheDocument()
      expect(screen.queryByText('portrait')).not.toBeInTheDocument()
    })
  })

  it('returns to the add-new form when editing is cancelled', async () => {
    const user = userEvent.setup()
    render(<TagsManager />)

    await user.click(screen.getByRole('button', { name: 'Edit landscape' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Add new')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('highlights the item currently being edited in the list', async () => {
    const user = userEvent.setup()
    const { container } = render(<TagsManager />)

    await user.click(screen.getByRole('button', { name: 'Edit landscape' }))

    const items = container.querySelectorAll('.manage-list-item')
    const editingItem = Array.from(items).find((item) => item.textContent?.includes('landscape'))
    expect(editingItem).toHaveClass('manage-list-item-editing')
  })

  it('deletes a tag after confirming, when it has media', async () => {
    const user = userEvent.setup()
    const del = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApi({ delete: del })
    render(<TagsManager />)

    await user.click(screen.getByRole('button', { name: 'Delete landscape' }))

    expect(confirmMock).toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith('t1')
    expect(refetchTags).toHaveBeenCalled()
  })

  it('does not delete when confirmation is declined', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const user = userEvent.setup()
    const del = vi.fn()
    setApi({ delete: del })
    render(<TagsManager />)

    await user.click(screen.getByRole('button', { name: 'Delete landscape' }))

    expect(del).not.toHaveBeenCalled()
  })

  it('deletes a tag immediately without confirming, when it has no media', async () => {
    const user = userEvent.setup()
    const del = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApi({ delete: del })
    render(<TagsManager />)

    await user.click(screen.getByRole('button', { name: 'Delete portrait' }))

    expect(confirmMock).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith('t2')
    expect(refetchTags).toHaveBeenCalled()
  })

  it('shows an empty state when there are no tags', () => {
    tagsData = []
    render(<TagsManager />)
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('disables the Add button until a name is entered', async () => {
    const user = userEvent.setup()
    render(<TagsManager />)

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()

    await user.type(screen.getByLabelText('Name'), 'new-tag')

    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('filters the list by search query', async () => {
    const user = userEvent.setup()
    render(<TagsManager />)

    await user.type(screen.getByRole('searchbox'), 'land')

    await waitFor(() => {
      expect(screen.getByText('landscape')).toBeInTheDocument()
      expect(screen.queryByText('portrait')).not.toBeInTheDocument()
    })
  })

  it('shows a no-results message when the search matches nothing', async () => {
    const user = userEvent.setup()
    render(<TagsManager />)

    await user.type(screen.getByRole('searchbox'), 'nonexistent')

    await waitFor(() => {
      expect(screen.getByText('No matches for your search.')).toBeInTheDocument()
    })
  })

  it('persists the chosen sort order and re-applies it on next render', async () => {
    const user = userEvent.setup()
    window.localStorage.clear()
    const { unmount } = render(<TagsManager />)

    await user.selectOptions(screen.getByLabelText('Sort by'), 'createdAt')
    await user.click(screen.getByRole('button', { name: 'Ascending' }))

    unmount()
    render(<TagsManager />)

    expect(screen.getByLabelText('Sort by')).toHaveValue('createdAt')
    expect(screen.getByRole('button', { name: 'Descending' })).toBeInTheDocument()
  })

  it('shows each tag media count, compactly formatted', () => {
    tagsData = [
      { id: 't1', name: 'landscape', createdAt: 1700000000000, mediaCount: 29000 },
      { id: 't2', name: 'portrait', createdAt: 1700000001000, mediaCount: 0 }
    ]
    render(<TagsManager />)

    const landscapeItem = screen.getByText('landscape').closest('li')
    const portraitItem = screen.getByText('portrait').closest('li')
    expect(landscapeItem).toHaveTextContent('29k')
    expect(portraitItem).toHaveTextContent('0')
  })

  it('renders a tag-wiki info button for each tag', async () => {
    render(<TagsManager />)
    expect(
      await screen.findByLabelText('What does this tag mean? (landscape)')
    ).toBeInTheDocument()
  })
})
