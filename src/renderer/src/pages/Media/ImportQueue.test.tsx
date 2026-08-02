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
  checkDuplicate.mockReset().mockResolvedValue({ success: true, data: { exactMatch: null, similar: [] } })
  Object.defineProperty(window, 'api', {
    value: {
      sourceFolder: { expandSelection },
      media: { create: mediaCreate, checkDuplicate },
      artist: { create: vi.fn() },
      tag: { create: vi.fn() },
      character: { create: vi.fn() },
      series: { create: vi.fn() },
      sauceNao: { lookup: vi.fn(), getApiKey: vi.fn().mockResolvedValue({ success: true, data: null }) }
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
      <ImportQueue selection={{ files: ['a.png', 'b.png'], folders: [] }} onClose={onClose} onLastSaved={onLastSaved} />
    </MemoryRouter>
  )
}

describe('ImportQueue', () => {
  it('expands the selection and shows the form for the first file', async () => {
    renderQueue()

    expect(await screen.findByText('File 1 of 2')).toBeInTheDocument()
    await vi.waitFor(() => expect(checkDuplicate).toHaveBeenCalledWith('/src/a.png'))
  })

  it('advances to the next file after saving', async () => {
    const { container } = renderQueue()
    await screen.findByText('File 1 of 2')

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    expect(await screen.findByText('File 2 of 2')).toBeInTheDocument()
    expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'a' }))
  })

  it('advances to the next file on Skip without saving', async () => {
    renderQueue()
    await screen.findByText('File 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('File 2 of 2')).toBeInTheDocument()
    expect(mediaCreate).not.toHaveBeenCalled()
  })

  it('calls onLastSaved after saving the final item', async () => {
    const onClose = vi.fn()
    const onLastSaved = vi.fn()
    const { container } = renderQueue(onClose, onLastSaved)
    await screen.findByText('File 1 of 2')

    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await screen.findByText('File 2 of 2')
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await vi.waitFor(() => expect(onLastSaved).toHaveBeenCalledWith({ id: 'm1' }))
  })

  it('calls onClose when Close is clicked mid-queue, without touching remaining items', async () => {
    const onClose = vi.fn()
    renderQueue(onClose)
    await screen.findByText('File 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mediaCreate).not.toHaveBeenCalled()
  })

  it('shows an error and no form when expandSelection fails', async () => {
    expandSelection.mockResolvedValue({ success: false, error: { code: 'INTERNAL', message: 'Boom' } })

    render(
      <MemoryRouter>
        <ImportQueue selection={{ files: [], folders: ['sub'] }} onClose={vi.fn()} onLastSaved={vi.fn()} />
      </MemoryRouter>
    )

    expect(await screen.findByText('Boom')).toBeInTheDocument()
  })
})
