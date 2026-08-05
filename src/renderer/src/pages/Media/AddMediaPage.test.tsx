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

/** Merged per-namespace (not a flat spread) so e.g. `setApi({ sauceNao: { lookup } })`
 * still keeps the default `sauceNao.getApiKey` instead of clobbering it. */
function setApi(overrides: Record<string, Record<string, unknown>> = {}): void {
  const defaults: Record<string, Record<string, unknown>> = {
    media: {
      create: vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } }),
      checkDuplicate: vi
        .fn()
        .mockResolvedValue({ success: true, data: { exactMatch: null, similar: [] } })
    },
    artist: {
      create: vi.fn(),
      addSocialLink: vi.fn().mockResolvedValue({ success: true, data: {} })
    },
    tag: { create: vi.fn() },
    character: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({ success: true, data: {} })
    },
    series: { create: vi.fn() },
    sauceNao: {
      lookup: vi.fn(),
      getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'test-key' })
    },
    sourceFolder: {
      get: vi.fn().mockResolvedValue({ success: true, data: null })
    }
  }

  const merged: Record<string, unknown> = {}
  for (const key of Object.keys(defaults)) {
    merged[key] = { ...defaults[key], ...overrides[key] }
  }

  Object.defineProperty(window, 'api', {
    value: merged,
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
    await user.click(await screen.findByRole('option', { name: 'Alice (Wonderland)' }))

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
    await user.click(await screen.findByRole('option', { name: 'Alice (Wonderland, Looking Glass)' }))

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

describe('AddMediaPage duplicate detection', () => {
  it('blocks submitting a file that already exists in the library', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    const checkDuplicate = vi.fn().mockResolvedValue({
      success: true,
      data: {
        exactMatch: { id: 'existing', name: 'Existing pic' },
        similar: []
      }
    })
    setApi({ media: { create: mediaCreate, checkDuplicate } })
    const user = userEvent.setup()
    const { container } = renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('sunset.png'))

    expect(
      await screen.findByText('This file is already in the library as "Existing pic".')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)
    expect(mediaCreate).not.toHaveBeenCalled()
  })

  it('shows a non-blocking warning for a visually similar existing file', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    const checkDuplicate = vi.fn().mockResolvedValue({
      success: true,
      data: {
        exactMatch: null,
        similar: [{ media: { id: 'similar1', name: 'Similar pic' }, distance: 4 }]
      }
    })
    setApi({ media: { create: mediaCreate, checkDuplicate } })
    const user = userEvent.setup()
    const { container } = renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('sunset.png'))

    expect(await screen.findByText('Similar pic (4/64 difference)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).not.toBeDisabled()

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)
    expect(mediaCreate).toHaveBeenCalled()
  })
})

describe('AddMediaPage SauceNAO suggestions', () => {
  it('disables the Suggest tags button until a file is chosen', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: 'Suggest tags' })).toBeDisabled()
  })

  it('calls the SauceNAO lookup with the selected file path when clicked', async () => {
    const lookup = vi.fn().mockResolvedValue({
      success: true,
      data: { match: null, remaining: { short: 5, long: 90 } }
    })
    setApi({ sauceNao: { lookup } })
    const user = userEvent.setup()
    renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('sunset.png'))
    await user.click(screen.getByRole('button', { name: 'Suggest tags' }))

    await vi.waitFor(() => expect(lookup).toHaveBeenCalledWith('sunset.png'))
  })

  it('pre-selects a suggested character that already exists in the library', async () => {
    charactersData = [{ id: 'c1', name: 'Alice', series: [] }]
    const lookup = vi.fn().mockResolvedValue({
      success: true,
      data: {
        match: {
          similarity: 90,
          indexName: 'Danbooru',
          sourceUrl: 'https://danbooru.donmai.us/posts/1',
          artist: null,
          characters: [{ name: 'Alice' }],
          series: [],
          seriesHints: [],
          tags: []
        },
        remaining: { short: 5, long: 90 }
      }
    })
    setApi({ sauceNao: { lookup } })
    const user = userEvent.setup()
    renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('pic.png'))
    await user.click(screen.getByRole('button', { name: 'Suggest tags' }))

    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })

  it('creates and adds a suggested character that is not yet in the library', async () => {
    const lookup = vi.fn().mockResolvedValue({
      success: true,
      data: {
        match: {
          similarity: 90,
          indexName: 'Danbooru',
          sourceUrl: 'https://danbooru.donmai.us/posts/1',
          artist: null,
          characters: [{ name: 'New Character' }],
          series: [],
          seriesHints: [],
          tags: []
        },
        remaining: { short: 5, long: 90 }
      }
    })
    const characterCreate = vi
      .fn()
      .mockResolvedValue({ success: true, data: { id: 'c9', name: 'New Character' } })
    setApi({ sauceNao: { lookup }, character: { create: characterCreate } })
    const user = userEvent.setup()
    renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('pic.png'))
    await user.click(screen.getByRole('button', { name: 'Suggest tags' }))

    const addChip = await screen.findByRole('button', { name: /New Character/ })
    await user.click(addChip)

    expect(characterCreate).toHaveBeenCalledWith({ name: 'New Character', seriesIds: [] })
    expect(refetchCharacters).toHaveBeenCalled()
  })

  it('capitalizes a suggested character name and auto-links the sole suggested series', async () => {
    const lookup = vi.fn().mockResolvedValue({
      success: true,
      data: {
        match: {
          similarity: 90,
          indexName: 'Danbooru',
          sourceUrl: 'https://danbooru.donmai.us/posts/1',
          artist: null,
          characters: [{ name: 'new character' }],
          series: [{ name: 'new series' }],
          seriesHints: [],
          tags: []
        },
        remaining: { short: 5, long: 90 }
      }
    })
    const characterCreate = vi
      .fn()
      .mockResolvedValue({ success: true, data: { id: 'c9', name: 'New character' } })
    const seriesCreate = vi
      .fn()
      .mockResolvedValue({ success: true, data: { id: 's9', name: 'New series' } })
    setApi({
      sauceNao: { lookup },
      character: { create: characterCreate },
      series: { create: seriesCreate }
    })
    const user = userEvent.setup()
    renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('pic.png'))
    await user.click(screen.getByRole('button', { name: 'Suggest tags' }))

    const addChip = await screen.findByRole('button', { name: 'New character' })
    await user.click(addChip)

    await vi.waitFor(() => expect(seriesCreate).toHaveBeenCalledWith({ name: 'New series' }))
    expect(characterCreate).toHaveBeenCalledWith({ name: 'New character', seriesIds: ['s9'] })
  })

  it('does not guess a series link when more than one series is suggested', async () => {
    const lookup = vi.fn().mockResolvedValue({
      success: true,
      data: {
        match: {
          similarity: 90,
          indexName: 'Danbooru',
          sourceUrl: 'https://danbooru.donmai.us/posts/1',
          artist: null,
          characters: [{ name: 'new character' }],
          series: [{ name: 'series one' }, { name: 'series two' }],
          seriesHints: [],
          tags: []
        },
        remaining: { short: 5, long: 90 }
      }
    })
    const characterCreate = vi
      .fn()
      .mockResolvedValue({ success: true, data: { id: 'c9', name: 'New character' } })
    const seriesCreate = vi.fn()
    setApi({
      sauceNao: { lookup },
      character: { create: characterCreate },
      series: { create: seriesCreate }
    })
    const user = userEvent.setup()
    renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('pic.png'))
    await user.click(screen.getByRole('button', { name: 'Suggest tags' }))

    const addChip = await screen.findByRole('button', { name: 'New character' })
    await user.click(addChip)

    await vi.waitFor(() => expect(characterCreate).toHaveBeenCalled())
    expect(characterCreate).toHaveBeenCalledWith({ name: 'New character', seriesIds: [] })
    expect(seriesCreate).not.toHaveBeenCalled()
  })

  it('shows an alert when the SauceNAO lookup fails', async () => {
    const lookup = vi.fn().mockResolvedValue({
      success: false,
      error: { code: 'INTERNAL', message: 'Could not reach SauceNAO.' }
    })
    setApi({ sauceNao: { lookup } })
    const user = userEvent.setup()
    renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('pic.png'))
    await user.click(screen.getByRole('button', { name: 'Suggest tags' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach SauceNAO.')
  })

  it('does not overwrite an already-selected artist with a suggestion', async () => {
    artistsData = [
      { id: 'a1', name: 'Chosen Artist' },
      { id: 'a2', name: 'Suggested Artist' }
    ]
    const lookup = vi.fn().mockResolvedValue({
      success: true,
      data: {
        match: {
          similarity: 90,
          indexName: 'Danbooru',
          sourceUrl: undefined,
          artist: { name: 'Suggested Artist' },
          characters: [],
          series: [],
          seriesHints: [],
          tags: []
        },
        remaining: { short: 5, long: 90 }
      }
    })
    setApi({ sauceNao: { lookup } })
    const user = userEvent.setup()
    renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('pic.png'))

    const [artistInput] = screen.getAllByRole('combobox')
    await user.type(artistInput, 'Chosen Artist')
    await user.click(await screen.findByRole('option', { name: 'Chosen Artist' }))

    await user.click(screen.getByRole('button', { name: 'Suggest tags' }))
    await vi.waitFor(() => expect(lookup).toHaveBeenCalled())

    expect(artistInput).toHaveValue('Chosen Artist')
  })
})

describe('AddMediaPage sole-series character linking', () => {
  it('links every selected character to the sole selected series on save, regardless of suggestions', async () => {
    seriesData = [{ id: 's1', name: 'Wonderland' }]
    charactersData = [
      { id: 'c1', name: 'Alice', series: [] },
      { id: 'c2', name: 'Bob', series: [] },
      { id: 'c3', name: 'Carol', series: [] }
    ]
    const characterUpdate = vi.fn().mockResolvedValue({ success: true, data: {} })
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({
      media: { create: mediaCreate },
      character: { create: vi.fn(), update: characterUpdate }
    })
    const user = userEvent.setup()
    const { container } = renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('pic.png'))

    const [, , charactersInput, seriesInput] = screen.getAllByRole('combobox')

    for (const name of ['Alice', 'Bob', 'Carol']) {
      await user.type(charactersInput, name)
      await user.click(await screen.findByRole('option', { name }))
    }
    await user.type(seriesInput, 'Wonderland')
    await user.click(await screen.findByRole('option', { name: 'Wonderland' }))

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await vi.waitFor(() => expect(mediaCreate).toHaveBeenCalled())
    expect(characterUpdate).toHaveBeenCalledTimes(3)
    expect(characterUpdate).toHaveBeenCalledWith('c1', {
      name: 'Alice',
      seriesIds: ['s1'],
      aliases: undefined
    })
    expect(characterUpdate).toHaveBeenCalledWith('c2', {
      name: 'Bob',
      seriesIds: ['s1'],
      aliases: undefined
    })
    expect(characterUpdate).toHaveBeenCalledWith('c3', {
      name: 'Carol',
      seriesIds: ['s1'],
      aliases: undefined
    })
    await vi.waitFor(() => expect(refetchCharacters).toHaveBeenCalled())
  })

  it('does not link characters when more than one series is selected', async () => {
    seriesData = [
      { id: 's1', name: 'Wonderland' },
      { id: 's2', name: 'Looking Glass' }
    ]
    charactersData = [{ id: 'c1', name: 'Alice', series: [] }]
    const characterUpdate = vi.fn()
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({
      media: { create: mediaCreate },
      character: { create: vi.fn(), update: characterUpdate }
    })
    const user = userEvent.setup()
    const { container } = renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('pic.png'))

    const [, , charactersInput, seriesInput] = screen.getAllByRole('combobox')
    await user.type(charactersInput, 'Alice')
    await user.click(await screen.findByRole('option', { name: 'Alice' }))

    for (const name of ['Wonderland', 'Looking Glass']) {
      await user.type(seriesInput, name)
      await user.click(await screen.findByRole('option', { name }))
    }

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await vi.waitFor(() => expect(mediaCreate).toHaveBeenCalled())
    expect(characterUpdate).not.toHaveBeenCalled()
  })

  it('does not re-link a character that already has the sole series', async () => {
    seriesData = [{ id: 's1', name: 'Wonderland' }]
    charactersData = [{ id: 'c1', name: 'Alice', series: [{ id: 's1', name: 'Wonderland' }] }]
    const characterUpdate = vi.fn()
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({
      media: { create: mediaCreate },
      character: { create: vi.fn(), update: characterUpdate }
    })
    const user = userEvent.setup()
    const { container } = renderPage()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile('pic.png'))

    const [, , charactersInput] = screen.getAllByRole('combobox')
    await user.type(charactersInput, 'Alice')
    await user.click(await screen.findByRole('option', { name: 'Alice (Wonderland)' }))
    // Alice has exactly one series already, so picking her auto-adds
    // Wonderland via the existing implied-series behavior.
    expect(await screen.findByText('Wonderland')).toBeInTheDocument()

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await vi.waitFor(() => expect(mediaCreate).toHaveBeenCalled())
    expect(characterUpdate).not.toHaveBeenCalled()
  })
})

describe('AddMediaPage folder tab', () => {
  it('disables the "From folder" tab when no source folder is configured', async () => {
    setApi({ sourceFolder: { get: vi.fn().mockResolvedValue({ success: true, data: null }) } })
    renderPage()

    expect(await screen.findByRole('tab', { name: 'From folder' })).toBeDisabled()
  })

  it('shows the folder browser when a source folder is configured and the tab is selected', async () => {
    const browse = vi.fn().mockResolvedValue({ success: true, data: { folders: [], files: [] } })
    setApi({
      sourceFolder: { get: vi.fn().mockResolvedValue({ success: true, data: 'D:\\Multimedia' }), browse }
    })
    const user = userEvent.setup()
    renderPage()

    const folderTab = await screen.findByRole('tab', { name: 'From folder' })
    expect(folderTab).not.toBeDisabled()
    await user.click(folderTab)

    await vi.waitFor(() => expect(browse).toHaveBeenCalledWith(''))
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument()
  })

  it('keeps the single-file tab active by default, unaffected by the new tab', async () => {
    setApi({ sourceFolder: { get: vi.fn().mockResolvedValue({ success: true, data: 'D:\\Multimedia' }) } })
    renderPage()

    expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  it('shows the folder browser again (not a stale queue) after switching to Single file and back mid-import', async () => {
    const browse = vi.fn().mockResolvedValue({
      success: true,
      data: { folders: [], files: [{ name: 'a.png', relativePath: 'a.png', type: 'image', cataloged: false }] }
    })
    // Never resolves, so the queue stays on its loading state until this tree unmounts.
    const expandSelection = vi.fn().mockReturnValue(new Promise(() => {}))
    setApi({
      sourceFolder: {
        get: vi.fn().mockResolvedValue({ success: true, data: 'D:\\Multimedia' }),
        browse,
        expandSelection
      }
    })
    const user = userEvent.setup()
    renderPage()

    const folderTab = await screen.findByRole('tab', { name: 'From folder' })
    await user.click(folderTab)

    const fileTile = await screen.findByText('a.png')
    await user.click(fileTile)
    await user.click(screen.getByRole('button', { name: /Import selected/ }))

    // Import started: the queue is mounted (browser's "Import selected" button is gone).
    await vi.waitFor(() => expect(expandSelection).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /Import selected/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Single file' }))
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'From folder' }))

    // Back on the folder tab: the browser is shown again, not a resumed/stale queue.
    expect(await screen.findByText('a.png')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Import selected/ })).toBeInTheDocument()
    expect(browse).toHaveBeenCalledTimes(2)
  })
})
