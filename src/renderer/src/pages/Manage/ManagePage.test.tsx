// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ManagePage from './ManagePage'

function activePanel(): HTMLElement {
  return document.querySelector('.manage-content > div:not([hidden])') as HTMLElement
}

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({
    data: [{ id: 'a1', name: 'Jane Doe' }],
    loading: false,
    error: null,
    refetch: vi.fn()
  }),
  useTags: () => ({
    data: [{ id: 't1', name: 'landscape' }],
    loading: false,
    error: null,
    refetch: vi.fn()
  }),
  useCharacters: () => ({
    data: [{ id: 'c1', name: 'Alice', series: [] }],
    loading: false,
    error: null,
    refetch: vi.fn()
  }),
  useSeries: () => ({
    data: [{ id: 's1', name: 'Wonderland' }],
    loading: false,
    error: null,
    refetch: vi.fn()
  })
}))

vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true)
}))

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    value: {
      artist: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      tag: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      character: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      series: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      media: {
        getEntityThumbnails: vi.fn().mockResolvedValue({ success: true, data: [] })
      },
      danbooru: {
        autocompleteTags: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getCredentials: vi.fn().mockResolvedValue({ success: true, data: undefined })
      },
      tagWiki: {
        lookup: vi.fn().mockResolvedValue({ success: true, data: null })
      }
    },
    writable: true,
    configurable: true
  })
})

describe('ManagePage', () => {
  it('shows the artists tab by default', () => {
    render(<ManagePage />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('switches to the tags tab', async () => {
    const user = userEvent.setup()
    render(<ManagePage />)

    await user.click(screen.getByRole('tab', { name: 'Tags' }))

    expect(screen.getByText('landscape')).toBeVisible()
    expect(screen.getByText('Jane Doe')).not.toBeVisible()
  })

  it('switches to the characters tab', async () => {
    const user = userEvent.setup()
    render(<ManagePage />)

    await user.click(screen.getByRole('tab', { name: 'Characters' }))

    expect(screen.getByText('Alice')).toBeVisible()
  })

  it('switches to the series tab', async () => {
    const user = userEvent.setup()
    render(<ManagePage />)

    await user.click(screen.getByRole('tab', { name: 'Series' }))

    // The (hidden, but still mounted) Characters tab now has its own series filter
    // listing 'Wonderland' as an <option>, so scope to the active panel.
    expect(within(activePanel()).getByText('Wonderland')).toBeVisible()
  })

  it('preserves a draft name after switching tabs away and back', async () => {
    const user = userEvent.setup()
    render(<ManagePage />)

    await user.type(within(activePanel()).getByLabelText('Name'), 'Draft Artist')
    await user.click(screen.getByRole('tab', { name: 'Tags' }))
    await user.click(screen.getByRole('tab', { name: 'Artists' }))

    expect(within(activePanel()).getByLabelText('Name')).toHaveValue('Draft Artist')
  })
})
