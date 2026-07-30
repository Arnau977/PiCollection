// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ArtistModel } from '@shared/models'
import { ArtistsManager } from './ArtistsManager'

const refetchArtists = vi.fn()
let artistsData: ArtistModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({ data: artistsData, loading: false, error: null, refetch: refetchArtists })
}))

function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      artist: {
        create: vi.fn().mockResolvedValue({ success: true, data: {} }),
        update: vi.fn().mockResolvedValue({ success: true, data: {} }),
        delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        addSocialLink: vi.fn().mockResolvedValue({ success: true, data: {} }),
        removeSocialLink: vi.fn().mockResolvedValue({ success: true, data: {} }),
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
  artistsData = [
    {
      id: 'a1',
      name: 'Jane Doe',
      socials: [{ id: 's1', name: 'Twitter', url: 'https://twitter.com/jane' }]
    },
    { id: 'a2', name: 'John Smith', socials: [] }
  ]
  refetchArtists.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  setApi()
})

describe('ArtistsManager', () => {
  it('renders existing artists', () => {
    render(<ArtistsManager />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('John Smith')).toBeInTheDocument()
  })

  it('creates a new artist', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue({ success: true, data: {} })
    setApi({ create })
    render(<ArtistsManager />)

    await user.type(screen.getByLabelText('Name'), 'New Artist')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(create).toHaveBeenCalledWith({ name: 'New Artist' })
    expect(refetchArtists).toHaveBeenCalled()
  })

  it('does not show a social links section while creating a new artist', () => {
    render(<ArtistsManager />)
    expect(screen.queryByText('Social links')).not.toBeInTheDocument()
  })

  it('switches the panel into edit mode, pre-filling the name and showing its social links', async () => {
    const user = userEvent.setup()
    render(<ArtistsManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Jane Doe' }))

    expect(screen.getByText('Editing "Jane Doe"')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByText('Social links')).toBeInTheDocument()
    expect(screen.getByText('Twitter')).toBeInTheDocument()
  })

  it('edits an artist name', async () => {
    const user = userEvent.setup()
    const update = vi.fn().mockResolvedValue({ success: true, data: {} })
    setApi({ update })
    render(<ArtistsManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Jane Doe' }))
    const input = screen.getByLabelText('Name')
    await user.clear(input)
    await user.type(input, 'Jane Smith')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith('a1', { name: 'Jane Smith' })
    expect(refetchArtists).toHaveBeenCalled()
  })

  it('returns to the add-new form when editing is cancelled', async () => {
    const user = userEvent.setup()
    render(<ArtistsManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Jane Doe' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Add new')).toBeInTheDocument()
    expect(screen.queryByText('Social links')).not.toBeInTheDocument()
  })

  it('deletes an artist after confirming', async () => {
    const user = userEvent.setup()
    const del = vi.fn().mockResolvedValue({ success: true, data: undefined })
    setApi({ delete: del })
    render(<ArtistsManager />)

    await user.click(screen.getByRole('button', { name: 'Delete Jane Doe' }))

    expect(del).toHaveBeenCalledWith('a1')
    expect(refetchArtists).toHaveBeenCalled()
  })

  it('adds a new social link while editing an artist', async () => {
    const user = userEvent.setup()
    const addSocialLink = vi.fn().mockResolvedValue({ success: true, data: {} })
    setApi({ addSocialLink })
    render(<ArtistsManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Jane Doe' }))
    await user.type(screen.getByLabelText('Label'), 'Instagram')
    await user.type(screen.getByLabelText('URL'), 'https://instagram.com/jane')
    await user.click(screen.getByRole('button', { name: 'Add link' }))

    expect(addSocialLink).toHaveBeenCalledWith('a1', {
      name: 'Instagram',
      url: 'https://instagram.com/jane'
    })
    expect(refetchArtists).toHaveBeenCalled()
  })

  it('removes a social link while editing an artist', async () => {
    const user = userEvent.setup()
    const removeSocialLink = vi.fn().mockResolvedValue({ success: true, data: {} })
    setApi({ removeSocialLink })
    render(<ArtistsManager />)

    await user.click(screen.getByRole('button', { name: 'Edit Jane Doe' }))
    await user.click(screen.getByRole('button', { name: 'Delete Twitter' }))

    expect(removeSocialLink).toHaveBeenCalledWith('a1', 's1')
    expect(refetchArtists).toHaveBeenCalled()
  })

  it('shows an empty state when there are no artists', () => {
    artistsData = []
    render(<ArtistsManager />)
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('disables the Add button until a name is entered', async () => {
    const user = userEvent.setup()
    render(<ArtistsManager />)

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()

    await user.type(screen.getByLabelText('Name'), 'New Artist')

    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('filters the list by search query', async () => {
    const user = userEvent.setup()
    render(<ArtistsManager />)

    await user.type(screen.getByRole('searchbox'), 'jane')

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText('John Smith')).not.toBeInTheDocument()
  })
})
