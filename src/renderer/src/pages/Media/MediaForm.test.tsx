// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import type { CharacterModel } from '@shared/models'
import { MemoryRouter } from 'react-router-dom'
import { MediaForm } from './MediaForm'

function setApi(overrides: Record<string, Record<string, unknown>> = {}): void {
  const defaults: Record<string, Record<string, unknown>> = {
    media: {
      create: vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } }),
      checkDuplicate: vi
        .fn()
        .mockResolvedValue({ success: true, data: { exactMatch: null, similar: [] } })
    },
    artist: { create: vi.fn() },
    tag: { create: vi.fn() },
    character: { create: vi.fn() },
    series: { create: vi.fn() },
    sauceNao: {
      lookup: vi.fn(),
      getApiKey: vi.fn().mockResolvedValue({ success: true, data: null })
    }
  }
  const merged: Record<string, unknown> = {}
  for (const key of Object.keys(defaults)) {
    merged[key] = { ...defaults[key], ...overrides[key] }
  }
  Object.defineProperty(window, 'api', { value: merged, writable: true, configurable: true })
}

let charactersData: CharacterModel[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useTags: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useCharacters: () => ({ data: charactersData, loading: false, error: null, refetch: vi.fn() }),
  useSeries: () => ({ data: [], loading: false, error: null, refetch: vi.fn() })
}))

function renderForm(props: Partial<ComponentProps<typeof MediaForm>> = {}) {
  const onCancel = vi.fn()
  const onSaved = vi.fn()
  const utils = render(
    <MemoryRouter>
      <MediaForm onCancel={onCancel} onSaved={onSaved} {...props} />
    </MemoryRouter>
  )
  return { ...utils, onCancel, onSaved }
}

beforeEach(() => {
  setApi()
  charactersData = []
})

describe('MediaForm initialFile', () => {
  it('hides the file input and preloads name/type/route from initialFile', async () => {
    const { container } = renderForm({
      initialFile: { route: '/pics/sunset.png', name: 'sunset', type: 'image' }
    })

    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument()
    const preview = container.querySelector('.media-preview img')
    expect(preview).toHaveAttribute('src', expect.stringContaining('app://media/'))
  })

  it('runs the duplicate check for the initial route on mount', async () => {
    const checkDuplicate = vi.fn().mockResolvedValue({
      success: true,
      data: { exactMatch: { id: 'existing', name: 'Existing pic' }, similar: [] }
    })
    setApi({ media: { checkDuplicate } })

    renderForm({ initialFile: { route: '/pics/sunset.png', name: 'sunset', type: 'image' } })

    expect(await screen.findByText('This file is already in the library as "Existing pic".')).toBeInTheDocument()
    expect(checkDuplicate).toHaveBeenCalledWith('/pics/sunset.png')
  })
})

describe('MediaForm queueInfo', () => {
  it('shows progress and a Save & next label instead of Add', async () => {
    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 2, total: 5, onSkip: vi.fn() }
    })

    expect(screen.getByText('File 2 of 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save & next' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })

  it('calls onSkip without saving when Skip is clicked', async () => {
    const onSkip = vi.fn()
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })

    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onSkip }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(mediaCreate).not.toHaveBeenCalled()
  })

  it('saves normally when Save & next is submitted', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })
    const { container, onSaved } = renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onSkip: vi.fn() }
    })

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await vi.waitFor(() => expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'a' })))
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled())
  })
})

describe('MediaForm character picker', () => {
  it('shows the linked series next to a character option in the picker', async () => {
    charactersData = [
      { id: 'c1', name: 'Ishtar', series: [{ id: 's1', name: 'Fate/Grand Order' }] }
    ]
    const user = userEvent.setup()
    renderForm({ initialFile: { route: '/pic.png', name: 'pic', type: 'image' } })

    const charactersCombobox = screen.getByRole('combobox', { name: /characters/i })
    await user.type(charactersCombobox, 'Ishtar')

    expect(
      await screen.findByRole('option', { name: 'Ishtar (Fate/Grand Order)' })
    ).toBeInTheDocument()
  })
})
