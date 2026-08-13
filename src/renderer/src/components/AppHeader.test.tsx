// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppHeader } from './AppHeader'

let emit: (event: unknown) => void = () => {}

beforeEach(() => {
  emit = () => {}
  Object.defineProperty(window, 'api', {
    value: {
      system: { getAppVersion: vi.fn().mockResolvedValue({ success: true, data: '1.0.0' }) },
      updater: {
        getChannel: vi.fn().mockResolvedValue({ success: true, data: 'stable' }),
        setChannel: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        checkForUpdates: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        downloadUpdate: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        quitAndInstall: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        onEvent: vi.fn((listener: (event: unknown) => void) => {
          emit = listener
          return () => {}
        })
      },
      tag: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
      character: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
      series: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
      artist: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
      entities: { onChanged: vi.fn().mockReturnValue(() => {}) }
    },
    writable: true,
    configurable: true
  })
})

describe('AppHeader', () => {
  it('links to the home, gallery, pending, metadata and settings routes', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/gallery')
    expect(screen.getByRole('link', { name: 'Pending' })).toHaveAttribute('href', '/pending')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: 'Metadata' })).toHaveAttribute('href', '/manage')
  })

  it('links the brand logo to home', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'PiCollection' })).toHaveAttribute('href', '/')
  })

  it('shows no update badge by default', () => {
    const { container } = render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    expect(container.querySelector('.app-sidebar-badge')).not.toBeInTheDocument()
  })

  it('shows a badge on Settings when an update is available', () => {
    const { container } = render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    act(() => emit({ type: 'available', version: '2.0.0', highlights: null }))

    expect(container.querySelector('.app-sidebar-badge')).toBeInTheDocument()
  })

  it('shows a badge on Settings when an update has finished downloading', () => {
    const { container } = render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    act(() => emit({ type: 'downloaded', version: '2.0.0' }))

    expect(container.querySelector('.app-sidebar-badge')).toBeInTheDocument()
  })
})
