// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ArtistModel, CharacterModel, SeriesModel, TagModel } from '@shared/models'
import AddMediaPage from './AddMediaPage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => navigateMock
  }
})

const refetchArtists = vi.fn()
const refetchTags = vi.fn()
const refetchCharacters = vi.fn()
const refetchSeries = vi.fn()

let artistsData: ArtistModel[] = []
let tagsData: TagModel[] = []
let seriesData: SeriesModel[] = []
let charactersData: CharacterModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({ data: artistsData, loading: false, error: null, refetch: refetchArtists }),
  useTags: () => ({ data: tagsData, loading: false, error: null, refetch: refetchTags }),
  useCharacters: () => ({
    data: charactersData,
    loading: false,
    error: null,
    refetch: refetchCharacters
  }),
  useSeries: () => ({ data: seriesData, loading: false, error: null, refetch: refetchSeries })
}))

function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      media: { create: vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } }) },
      artist: { create: vi.fn() },
      tag: { create: vi.fn() },
      character: { create: vi.fn() },
      series: { create: vi.fn() },
      ...overrides
    },
    writable: true,
    configurable: true
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AddMediaPage />
    </MemoryRouter>
  )
}

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' })
}

beforeEach(() => {
  navigateMock.mockClear()
  artistsData = []
  tagsData = []
  seriesData = []
  charactersData = []
  refetchArtists.mockReset()
  refetchTags.mockReset()
  refetchCharacters.mockReset()
  refetchSeries.mockReset()
  setApi()
})

describe('AddMediaPage', () => {
  it('does not render a manual name field', () => {
    renderPage()
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
  })

  it('navigates back to the gallery when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(navigateMock).toHaveBeenCalledWith('/gallery')
  })

  it('derives the media name from the selected file and navigates to the new media on success', async () => {
    const user = userEvent.setup()
    const mediaCreate = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'm1',
        name: 'sunset',
        type: 'image',
        route: '/tmp/sunset.png',
        sfw: true,
        isAiGenerated: false,
        createdAt: Date.now()
      }
    })
    setApi({ media: { create: mediaCreate } })
    const { container } = renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('sunset.png'))

    // jsdom does not mark a `required` file input as valid after userEvent.upload,
    // so submit the form directly instead of clicking the (browser-validated) button.
    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'sunset' }))
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/media/m1'))
  })

  it('shows a preview of the selected file', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()

    expect(container.querySelector('.media-preview')).not.toBeInTheDocument()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('sunset.png'))

    const preview = container.querySelector('.media-preview img')
    expect(preview).toHaveAttribute('src', expect.stringContaining('app://media/'))
  })

  it('includes the AI-generated flag when the checkbox is checked', async () => {
    const user = userEvent.setup()
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })
    const { container } = renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('sunset.png'))
    await user.click(screen.getByRole('checkbox', { name: 'AI-generated' }))

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ isAiGenerated: true }))
  })

  it('shows a "Create" option when typing a tag name that does not exist, and creates it', async () => {
    const user = userEvent.setup()
    const tagCreate = vi
      .fn()
      .mockResolvedValue({ success: true, data: { id: 't1', name: 'landscape' } })
    setApi({ tag: { create: tagCreate } })
    refetchTags.mockImplementation(() => {
      tagsData = [{ id: 't1', name: 'landscape' }]
    })
    renderPage()

    const [, tagsInput] = screen.getAllByRole('combobox')
    await user.type(tagsInput, 'landscape')

    const createOption = await screen.findByText('Create "landscape"')
    await user.click(createOption)

    expect(tagCreate).toHaveBeenCalledWith({ name: 'landscape' })
    expect(refetchTags).toHaveBeenCalled()
    expect(await screen.findByText('landscape')).toBeInTheDocument()
  })

  it('auto-selects the series of a character that belongs to exactly one', async () => {
    seriesData = [{ id: 's1', name: 'Wonderland' }]
    charactersData = [{ id: 'c1', name: 'Alice', series: [{ id: 's1', name: 'Wonderland' }] }]
    const user = userEvent.setup()
    renderPage()

    const [, , charactersInput] = screen.getAllByRole('combobox')
    await user.type(charactersInput, 'Alice')
    await user.click(await screen.findByRole('option', { name: 'Alice' }))

    // The series chip appears without the user touching the Series field.
    expect(await screen.findByText('Wonderland')).toBeInTheDocument()
  })

  it('does not auto-select a series when the character belongs to several', async () => {
    seriesData = [
      { id: 's1', name: 'Wonderland' },
      { id: 's2', name: 'Looking Glass' }
    ]
    charactersData = [
      {
        id: 'c1',
        name: 'Alice',
        series: [
          { id: 's1', name: 'Wonderland' },
          { id: 's2', name: 'Looking Glass' }
        ]
      }
    ]
    const user = userEvent.setup()
    renderPage()

    const [, , charactersInput] = screen.getAllByRole('combobox')
    await user.type(charactersInput, 'Alice')
    await user.click(await screen.findByRole('option', { name: 'Alice' }))

    expect(screen.queryByText('Wonderland')).not.toBeInTheDocument()
    expect(screen.queryByText('Looking Glass')).not.toBeInTheDocument()
  })

  it('does not auto-select a series when the character has none', async () => {
    seriesData = [{ id: 's1', name: 'Wonderland' }]
    charactersData = [{ id: 'c1', name: 'Bob', series: [] }]
    const user = userEvent.setup()
    renderPage()

    const [, , charactersInput] = screen.getAllByRole('combobox')
    await user.type(charactersInput, 'Bob')
    await user.click(await screen.findByRole('option', { name: 'Bob' }))

    expect(screen.queryByText('Wonderland')).not.toBeInTheDocument()
  })

  it('does not show a "Create" option when the typed name already exists', async () => {
    tagsData = [{ id: 't1', name: 'landscape' }]
    const user = userEvent.setup()
    renderPage()

    const [, tagsInput] = screen.getAllByRole('combobox')
    await user.type(tagsInput, 'landscape')

    expect(screen.queryByText('Create "landscape"')).not.toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'landscape' })).toBeInTheDocument()
  })
})
