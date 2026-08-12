// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { MediaModel } from '@shared/models'
import MediaPage from './MediaPage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: '1' })
  }
})

const sampleMedia: MediaModel = {
  id: '1',
  name: 'My picture',
  type: 'image',
  route: '/pics/1.png',
  sfw: true,
  isAiGenerated: false,
  createdAt: Date.now(),
  tags: [{ id: 't1', name: 'landscape' }],
  pendingTagging: false
}

let mediaData: MediaModel = sampleMedia

const refetchMock = vi.fn()

vi.mock('../../hooks/useMediaById', () => ({
  useMediaById: () => ({ data: mediaData, loading: false, error: null, refetch: refetchMock })
}))

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useTags: () => ({
    data: [{ id: 't1', name: 'landscape' }],
    loading: false,
    error: null,
    refetch: vi.fn()
  }),
  useCharacters: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useSeries: () => ({ data: [], loading: false, error: null, refetch: vi.fn() })
}))

const confirmMock = vi.fn().mockResolvedValue(true)

vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => confirmMock
}))

function renderMediaPage() {
  return render(
    <MemoryRouter>
      <MediaPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  navigateMock.mockClear()
  refetchMock.mockClear()
  confirmMock.mockClear()
  confirmMock.mockResolvedValue(true)
  mediaData = sampleMedia
  Object.defineProperty(window, 'api', {
    value: {
      media: {
        update: vi.fn().mockResolvedValue({ success: true, data: sampleMedia }),
        getOrderedIds: vi.fn().mockResolvedValue({ success: true, data: ['0', '1', '2'] }),
        delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        clearPendingTagging: vi.fn().mockResolvedValue({ success: true, data: sampleMedia })
      },
      artist: { create: vi.fn() },
      tag: { create: vi.fn() },
      character: { create: vi.fn() },
      series: { create: vi.fn() },
      system: { showInFolder: vi.fn() },
      sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
    },
    writable: true,
    configurable: true
  })
})

describe('MediaPage back navigation', () => {
  it('navigates to the gallery when the back button is clicked', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByRole('button', { name: /back to gallery/i }))

    expect(navigateMock).toHaveBeenCalledWith('/gallery')
  })

  it('navigates to the gallery when clicking outside the media/info panels', async () => {
    const user = userEvent.setup()
    const { container } = renderMediaPage()

    const pageRoot = container.querySelector('.media-page') as HTMLElement
    await user.click(pageRoot)

    expect(navigateMock).toHaveBeenCalledWith('/gallery')
  })

  it('does not navigate when clicking on the media image', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByAltText('My picture'))

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does not navigate when clicking on the info panel text', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByText('landscape'))

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does not navigate when clicking the Edit button', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(navigateMock).not.toHaveBeenCalled()
  })
})

function setOrderedIds(data: string[]): void {
  Object.defineProperty(window, 'api', {
    value: {
      media: {
        update: vi.fn().mockResolvedValue({ success: true, data: sampleMedia }),
        getOrderedIds: vi.fn().mockResolvedValue({ success: true, data }),
        delete: vi.fn().mockResolvedValue({ success: true, data: undefined })
      },
      artist: { create: vi.fn() },
      tag: { create: vi.fn() },
      character: { create: vi.fn() },
      series: { create: vi.fn() },
      system: { showInFolder: vi.fn() },
      sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
    },
    writable: true,
    configurable: true
  })
}

describe('MediaPage adjacent navigation', () => {
  it('renders the image nav zones once the sibling ids resolve, and wires them to navigate', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument()
    )
    await user.click(screen.getByRole('button', { name: 'Next image' }))
    expect(navigateMock).toHaveBeenCalledWith('/media/2', { replace: true })

    navigateMock.mockClear()
    await user.click(screen.getByRole('button', { name: 'Previous image' }))
    expect(navigateMock).toHaveBeenCalledWith('/media/0', { replace: true })
  })

  it('omits the previous zone on the first item and the next zone on the last item', async () => {
    setOrderedIds(['1', '2'])
    const { unmount } = renderMediaPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument()
    )
    expect(screen.queryByRole('button', { name: 'Previous image' })).not.toBeInTheDocument()
    unmount()

    setOrderedIds(['0', '1'])
    renderMediaPage()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Previous image' })).toBeInTheDocument()
    )
    expect(screen.queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument()
  })

  it('navigates with the right/left arrow keys', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument()
    )

    await user.keyboard('{ArrowRight}')
    expect(navigateMock).toHaveBeenCalledWith('/media/2', { replace: true })

    navigateMock.mockClear()
    await user.keyboard('{ArrowLeft}')
    expect(navigateMock).toHaveBeenCalledWith('/media/0', { replace: true })
  })

  it('does not navigate on arrow keys while editing', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument()
    )
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    await user.keyboard('{ArrowRight}')

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does not navigate on arrow keys while typing in a text field', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument()
    )
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByDisplayValue('My picture')

    await user.click(nameInput)
    await user.keyboard('{ArrowRight}')

    expect(navigateMock).not.toHaveBeenCalled()
  })
})

describe('MediaPage file actions', () => {
  it('shows icon-only copy/open-in-folder actions on the detail view', () => {
    renderMediaPage()

    expect(screen.getByRole('button', { name: 'Copy location' })).toBeInTheDocument()
    const openInFolder = screen.getByRole('button', { name: 'Open in file explorer' })
    expect(openInFolder).toBeInTheDocument()
    expect(openInFolder).toHaveTextContent('')
  })

  it('reveals the file in the explorer without navigating away', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByRole('button', { name: 'Open in file explorer' }))

    expect(window.api.system.showInFolder).toHaveBeenCalledWith('/pics/1.png')
    expect(navigateMock).not.toHaveBeenCalled()
  })
})

describe('MediaPage lightbox', () => {
  it('closes back to the detail view instead of the gallery when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderMediaPage()

    await user.click(screen.getByAltText('My picture'))
    expect(container.querySelector('.lightbox-backdrop')).toBeInTheDocument()

    await user.click(container.querySelector('.lightbox-backdrop') as HTMLElement)

    expect(container.querySelector('.lightbox-backdrop')).not.toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'My picture' })).toBeInTheDocument()
  })

  it('closes back to the detail view when the close button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderMediaPage()

    await user.click(screen.getByAltText('My picture'))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(container.querySelector('.lightbox-backdrop')).not.toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})

describe('MediaPage editing', () => {
  it('shows an edit form pre-filled with the current values when Edit is clicked', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByDisplayValue('My picture')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('shows a preview of the media being edited', async () => {
    const user = userEvent.setup()
    const { container } = renderMediaPage()

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const preview = container.querySelector('.media-preview img')
    expect(preview).toHaveAttribute('src', expect.stringContaining('app://media/'))
  })

  it('does not navigate to the gallery when clicking inside the edit form', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByDisplayValue('My picture'))

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('saves changes and returns to the display view', async () => {
    const update = vi.fn().mockResolvedValue({ success: true, data: sampleMedia })
    Object.defineProperty(window, 'api', {
      value: {
        media: {
          update,
          getOrderedIds: vi.fn().mockResolvedValue({ success: true, data: ['1'] })
        },
        artist: { create: vi.fn() },
        tag: { create: vi.fn() },
        character: { create: vi.fn() },
        sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
      },
      writable: true,
      configurable: true
    })
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByDisplayValue('My picture')
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed picture')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ name: 'Renamed picture', sfw: true })
    )
    expect(refetchMock).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('cancels editing without saving', async () => {
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})

describe('MediaPage delete', () => {
  it('deletes on confirm and navigates to the gallery', async () => {
    const deleteFn = vi.fn().mockResolvedValue({ success: true, data: undefined })
    Object.defineProperty(window, 'api', {
      value: {
        media: {
          update: vi.fn().mockResolvedValue({ success: true, data: sampleMedia }),
          getOrderedIds: vi.fn().mockResolvedValue({ success: true, data: ['0', '1', '2'] }),
          delete: deleteFn
        },
        artist: { create: vi.fn() },
        tag: { create: vi.fn() },
        character: { create: vi.fn() },
        series: { create: vi.fn() },
        system: { showInFolder: vi.fn() },
        sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
      },
      writable: true,
      configurable: true
    })
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ danger: true }))
    await waitFor(() => expect(deleteFn).toHaveBeenCalledWith('1'))
    expect(navigateMock).toHaveBeenCalledWith('/gallery')
  })

  it('does not delete or navigate when the confirm dialog is dismissed', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const deleteFn = vi.fn()
    Object.defineProperty(window, 'api', {
      value: {
        media: {
          update: vi.fn().mockResolvedValue({ success: true, data: sampleMedia }),
          getOrderedIds: vi.fn().mockResolvedValue({ success: true, data: ['0', '1', '2'] }),
          delete: deleteFn
        },
        artist: { create: vi.fn() },
        tag: { create: vi.fn() },
        character: { create: vi.fn() },
        series: { create: vi.fn() },
        system: { showInFolder: vi.fn() },
        sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
      },
      writable: true,
      configurable: true
    })
    const user = userEvent.setup()
    renderMediaPage()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteFn).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})

describe('MediaPage pending queue', () => {
  it('starts in edit mode when arriving with location.state.pendingQueue', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/media/1', state: { pendingQueue: true } }]}>
        <MediaPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /^Save/ })).toBeInTheDocument()
  })

  it('shows progress across the pending queue and a Save & next label once the ordered list resolves', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/media/1', state: { pendingQueue: true } }]}>
        <MediaPage />
      </MemoryRouter>
    )

    // beforeEach's getOrderedIds resolves ['0', '1', '2'] - id '1' is index 1, i.e. 2 of 3.
    expect(await screen.findByText('File 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save & next' })).toBeInTheDocument()
  })

  it('Skip navigates to the next pending item without saving', async () => {
    const update = vi.fn().mockResolvedValue({ success: true, data: sampleMedia })
    Object.defineProperty(window, 'api', {
      value: {
        media: {
          update,
          getOrderedIds: vi.fn().mockResolvedValue({ success: true, data: ['0', '1', '2'] }),
          delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
          clearPendingTagging: vi.fn().mockResolvedValue({ success: true, data: sampleMedia })
        },
        artist: { create: vi.fn() },
        tag: { create: vi.fn() },
        character: { create: vi.fn() },
        series: { create: vi.fn() },
        system: { showInFolder: vi.fn() },
        sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
      },
      writable: true,
      configurable: true
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={[{ pathname: '/media/1', state: { pendingQueue: true } }]}>
        <MediaPage />
      </MemoryRouter>
    )
    await screen.findByText('File 2 of 3')
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(update).not.toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith('/media/2', { state: { pendingQueue: true }, replace: true })
  })

  it('stays in read mode when arriving without pendingQueue state', () => {
    render(
      <MemoryRouter initialEntries={['/media/1']}>
        <MediaPage />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('passes the pendingTagging override to getOrderedIds when arriving via the pending queue', async () => {
    const getOrderedIds = vi.fn().mockResolvedValue({ success: true, data: ['1', '2'] })
    Object.defineProperty(window, 'api', {
      value: {
        media: {
          update: vi.fn().mockResolvedValue({ success: true, data: sampleMedia }),
          getOrderedIds,
          delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
          clearPendingTagging: vi.fn().mockResolvedValue({ success: true, data: sampleMedia })
        },
        artist: { create: vi.fn() },
        tag: { create: vi.fn() },
        character: { create: vi.fn() },
        series: { create: vi.fn() },
        system: { showInFolder: vi.fn() },
        sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
      },
      writable: true,
      configurable: true
    })

    render(
      <MemoryRouter initialEntries={[{ pathname: '/media/1', state: { pendingQueue: true } }]}>
        <MediaPage />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(getOrderedIds).toHaveBeenCalledWith(
        { pendingTagging: true },
        { prop: 'createdAt', desc: false }
      )
    )
  })

  it('saving with Save & next advances to the next pending item after the update succeeds', async () => {
    const update = vi.fn().mockResolvedValue({ success: true, data: sampleMedia })
    Object.defineProperty(window, 'api', {
      value: {
        media: {
          update,
          getOrderedIds: vi.fn().mockResolvedValue({ success: true, data: ['0', '1', '2'] }),
          delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
          clearPendingTagging: vi.fn().mockResolvedValue({ success: true, data: sampleMedia })
        },
        artist: { create: vi.fn() },
        tag: { create: vi.fn() },
        character: { create: vi.fn() },
        series: { create: vi.fn() },
        system: { showInFolder: vi.fn() },
        sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
      },
      writable: true,
      configurable: true
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={[{ pathname: '/media/1', state: { pendingQueue: true } }]}>
        <MediaPage />
      </MemoryRouter>
    )
    await screen.findByRole('button', { name: 'Save & next' })
    await user.click(screen.getByRole('button', { name: 'Save & next' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith('1', expect.objectContaining({ name: 'My picture' })))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/media/2', { state: { pendingQueue: true }, replace: true }))
  })
})

describe('MediaPage mark resolved', () => {
  it('shows Mark resolved for a pending media in read mode', () => {
    mediaData = { ...sampleMedia, pendingTagging: true }

    render(
      <MemoryRouter initialEntries={['/media/1']}>
        <MediaPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: 'Mark resolved' })).toBeInTheDocument()
  })

  it('does not show Mark resolved for a media that is not pending', () => {
    render(
      <MemoryRouter initialEntries={['/media/1']}>
        <MediaPage />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: 'Mark resolved' })).not.toBeInTheDocument()
  })

  it('clicking Mark resolved calls clearPendingTagging and, outside the pending queue, refetches in place', async () => {
    mediaData = { ...sampleMedia, pendingTagging: true }
    const user = userEvent.setup()
    const clearPendingTagging = vi.fn().mockResolvedValue({ success: true, data: sampleMedia })
    Object.defineProperty(window, 'api', {
      value: {
        media: {
          update: vi.fn().mockResolvedValue({ success: true, data: sampleMedia }),
          getOrderedIds: vi.fn().mockResolvedValue({ success: true, data: ['0', '1', '2'] }),
          delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
          clearPendingTagging
        },
        artist: { create: vi.fn() },
        tag: { create: vi.fn() },
        character: { create: vi.fn() },
        series: { create: vi.fn() },
        system: { showInFolder: vi.fn() },
        sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
      },
      writable: true,
      configurable: true
    })

    render(
      <MemoryRouter initialEntries={['/media/1']}>
        <MediaPage />
      </MemoryRouter>
    )
    await user.click(screen.getByRole('button', { name: 'Mark resolved' }))

    expect(clearPendingTagging).toHaveBeenCalledWith('1')
    expect(navigateMock).not.toHaveBeenCalled()
    expect(refetchMock).toHaveBeenCalled()
  })

  it('clicking Mark resolved inside the pending queue navigates to the next pending item', async () => {
    mediaData = { ...sampleMedia, pendingTagging: true }
    const user = userEvent.setup()
    Object.defineProperty(window, 'api', {
      value: {
        media: {
          update: vi.fn().mockResolvedValue({ success: true, data: sampleMedia }),
          getOrderedIds: vi.fn().mockResolvedValue({ success: true, data: ['1', '2'] }),
          delete: vi.fn().mockResolvedValue({ success: true, data: undefined }),
          clearPendingTagging: vi.fn().mockResolvedValue({ success: true, data: sampleMedia })
        },
        artist: { create: vi.fn() },
        tag: { create: vi.fn() },
        character: { create: vi.fn() },
        series: { create: vi.fn() },
        system: { showInFolder: vi.fn() },
        sauceNao: { getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' }) }
      },
      writable: true,
      configurable: true
    })

    render(
      <MemoryRouter initialEntries={[{ pathname: '/media/1', state: { pendingQueue: true } }]}>
        <MediaPage />
      </MemoryRouter>
    )
    await screen.findByRole('button', { name: 'Save' })
    await user.click(screen.getByRole('button', { name: 'Mark resolved' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/media/2', { state: { pendingQueue: true }, replace: true }))
  })
})
