// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ImportQueue } from './ImportQueue'

const expandSelection = vi.fn()
const mediaCreate = vi.fn()
const checkDuplicate = vi.fn()

beforeEach(() => {
  expandSelection.mockReset()
  mediaCreate.mockReset().mockResolvedValue({ success: true, data: { id: 'm1' } })
  checkDuplicate
    .mockReset()
    .mockResolvedValue({ success: true, data: { exactMatch: null, similar: [] } })
  Object.defineProperty(window, 'api', {
    value: {
      sourceFolder: { expandSelection },
      media: { create: mediaCreate, checkDuplicate },
      artist: { create: vi.fn() },
      tag: { create: vi.fn() },
      character: { create: vi.fn() },
      series: { create: vi.fn() },
      sauceNao: {
        lookup: vi.fn(),
        getApiKey: vi.fn().mockResolvedValue({ success: true, data: null })
      },
      wd14Runtime: {
        getStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'not-installed' } }),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      wd14Tagger: { suggestTags: vi.fn() }
    },
    writable: true,
    configurable: true
  })
})

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useTags: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useCharacters: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useSeries: () => ({ data: [], loading: false, error: null, refetch: vi.fn() })
}))

function renderQueue(onClose = vi.fn(), onLastSaved = vi.fn()) {
  expandSelection.mockResolvedValue({
    success: true,
    data: [
      { route: '/src/a.png', fileName: 'a.png', type: 'image' },
      { route: '/src/b.png', fileName: 'b.png', type: 'image' }
    ]
  })
  return render(
    <MemoryRouter>
      <ImportQueue
        selection={{ files: ['a.png', 'b.png'], folders: [] }}
        onClose={onClose}
        onLastSaved={onLastSaved}
      />
    </MemoryRouter>
  )
}

describe('ImportQueue', () => {
  it('expands the selection and shows the form for the first file', async () => {
    renderQueue()

    expect(await screen.findByText('File 1 of 2')).toBeInTheDocument()
    await vi.waitFor(() => expect(checkDuplicate).toHaveBeenCalledWith('/src/a.png'))
  })

  it('saves without advancing, and only moves to the next file once Next is clicked', async () => {
    const { container } = renderQueue()
    await screen.findByText('File 1 of 2')

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await vi.waitFor(() => expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'a' })))
    expect(screen.getByText('File 1 of 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('File 2 of 2')).toBeInTheDocument()
  })

  it('hides Previous on the first file and moves back to it from the second, discarding unsaved edits', async () => {
    renderQueue()
    await screen.findByText('File 1 of 2')
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('File 2 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))

    expect(await screen.findByText('File 1 of 2')).toBeInTheDocument()
  })

  it('advances to the next file on Next without saving', async () => {
    renderQueue()
    await screen.findByText('File 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('File 2 of 2')).toBeInTheDocument()
    expect(mediaCreate).not.toHaveBeenCalled()
  })

  it('calls onLastSaved once Next is clicked after saving the final item', async () => {
    const onClose = vi.fn()
    const onLastSaved = vi.fn()
    const { container } = renderQueue(onClose, onLastSaved)
    await screen.findByText('File 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('File 2 of 2')
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await vi.waitFor(() => expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'b' })))

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await vi.waitFor(() => expect(onLastSaved).toHaveBeenCalledWith({ id: 'm1' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes instead of calling onLastSaved when Next is clicked unsaved on the final item', async () => {
    const onClose = vi.fn()
    const onLastSaved = vi.fn()
    renderQueue(onClose, onLastSaved)
    await screen.findByText('File 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('File 2 of 2')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onLastSaved).not.toHaveBeenCalled()
  })

  it('opens the exit dialog instead of closing when Close is clicked with items remaining', async () => {
    const onClose = vi.fn()
    renderQueue(onClose)
    await screen.findByText('File 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add remaining to Pending' })).toBeInTheDocument()
  })

  it('exit dialog: Keep editing dismisses the dialog and stays on the current item', async () => {
    renderQueue()
    await screen.findByText('File 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))

    expect(
      screen.queryByRole('button', { name: 'Add remaining to Pending' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('File 1 of 2')).toBeInTheDocument()
  })

  it('exit dialog: Discard closes without creating anything for the remaining files', async () => {
    const onClose = vi.fn()
    renderQueue(onClose)
    await screen.findByText('File 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mediaCreate).not.toHaveBeenCalled()
  })

  it('exit dialog: Add remaining to Pending bulk-creates every unprocessed file with pendingTagging: true, then closes', async () => {
    const onClose = vi.fn()
    renderQueue(onClose)
    await screen.findByText('File 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add remaining to Pending' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(mediaCreate).toHaveBeenCalledTimes(2)
    expect(mediaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'a', route: '/src/a.png', pendingTagging: true })
    )
    expect(mediaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'b', route: '/src/b.png', pendingTagging: true })
    )
  })

  it('still opens the exit dialog on the last item, since it is itself unprocessed, and Add to Pending only creates that one', async () => {
    const onClose = vi.fn()
    const { container } = renderQueue(onClose)
    await screen.findByText('File 1 of 2')

    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await vi.waitFor(() => expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'a' })))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('File 2 of 2')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.getByRole('button', { name: 'Add remaining to Pending' })).toBeInTheDocument()
    mediaCreate.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Add remaining to Pending' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(mediaCreate).toHaveBeenCalledTimes(1)
    expect(mediaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'b', route: '/src/b.png', pendingTagging: true })
    )
  })

  it('shows an error and no form when expandSelection fails', async () => {
    expandSelection.mockResolvedValue({
      success: false,
      error: { code: 'INTERNAL', message: 'Boom' }
    })

    render(
      <MemoryRouter>
        <ImportQueue
          selection={{ files: [], folders: ['sub'] }}
          onClose={vi.fn()}
          onLastSaved={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(await screen.findByText('Boom')).toBeInTheDocument()
  })

  it('shows an empty message and a Close button, with no form, when the expansion has no files', async () => {
    const onClose = vi.fn()
    expandSelection.mockResolvedValue({ success: true, data: [] })

    const { container } = render(
      <MemoryRouter>
        <ImportQueue
          selection={{ files: [], folders: ['sub'] }}
          onClose={onClose}
          onLastSaved={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(
      await screen.findByText(
        'No files to import — everything in your selection is already in the library.'
      )
    ).toBeInTheDocument()
    expect(mediaCreate).not.toHaveBeenCalled()
    expect(container.querySelector('form')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
