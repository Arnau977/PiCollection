// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DanbooruSection } from './DanbooruSection'

function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      danbooru: {
        getCredentials: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        setCredentials: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        ...overrides
      }
    },
    writable: true,
    configurable: true
  })
}

beforeEach(() => {
  setApi()
})

describe('DanbooruSection', () => {
  it('prefills the saved username and API key on mount', async () => {
    setApi({
      getCredentials: vi
        .fn()
        .mockResolvedValue({ success: true, data: { username: 'arnau', apiKey: 'abc123' } })
    })
    render(<DanbooruSection />)

    expect(await screen.findByDisplayValue('arnau')).toBeInTheDocument()
    expect(screen.getByDisplayValue('abc123')).toBeInTheDocument()
  })

  it('saves the entered username and API key', async () => {
    const user = userEvent.setup()
    render(<DanbooruSection />)
    await screen.findByLabelText('Username')

    await user.type(screen.getByLabelText('Username'), 'arnau')
    await user.type(screen.getByLabelText('API key'), 'abc123')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.api.danbooru.setCredentials).toHaveBeenCalledWith({
      username: 'arnau',
      apiKey: 'abc123'
    })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('shows the rejection message when Danbooru rejects the credentials', async () => {
    setApi({
      setCredentials: vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'Danbooru rejected that username/API key.' }
      })
    })
    const user = userEvent.setup()
    render(<DanbooruSection />)
    await screen.findByLabelText('Username')

    await user.type(screen.getByLabelText('Username'), 'arnau')
    await user.type(screen.getByLabelText('API key'), 'wrong-key')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Danbooru rejected that username/API key.'
    )
  })

  it('clears saved credentials', async () => {
    setApi({
      getCredentials: vi
        .fn()
        .mockResolvedValue({ success: true, data: { username: 'arnau', apiKey: 'abc123' } })
    })
    const user = userEvent.setup()
    render(<DanbooruSection />)
    await screen.findByDisplayValue('arnau')

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(window.api.danbooru.setCredentials).toHaveBeenCalledWith(undefined)
    expect(screen.getByLabelText('Username')).toHaveValue('')
    expect(screen.getByLabelText('API key')).toHaveValue('')
  })

  it('links to the Danbooru profile page to get an API key', async () => {
    render(<DanbooruSection />)

    expect(await screen.findByRole('link', { name: 'Get your API key' })).toHaveAttribute(
      'href',
      'https://danbooru.donmai.us/profile'
    )
  })
})
