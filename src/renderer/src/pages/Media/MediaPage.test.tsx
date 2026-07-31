// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  tags: [{ id: 't1', name: 'landscape' }]
}

const refetchMock = vi.fn()

vi.mock('../../hooks/useMediaById', () => ({
  useMediaById: () => ({ data: sampleMedia, loading: false, error: null, refetch: refetchMock })
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
  Object.defineProperty(window, 'api', {
    value: {
      media: { update: vi.fn().mockResolvedValue({ success: true, data: sampleMedia }) },
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

    await user.click(container.querySelector('.media-detail-media') as HTMLElement)
    expect(container.querySelector('.lightbox-backdrop')).toBeInTheDocument()

    await user.click(container.querySelector('.lightbox-backdrop') as HTMLElement)

    expect(container.querySelector('.lightbox-backdrop')).not.toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'My picture' })).toBeInTheDocument()
  })

  it('closes back to the detail view when the close button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderMediaPage()

    await user.click(container.querySelector('.media-detail-media') as HTMLElement)
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
        media: { update },
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
