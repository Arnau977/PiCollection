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
        getStatus: vi.fn().mockResolvedValue({ success: true, data: null }),
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

  it('shows an update toast once, and dismisses it for the rest of the session', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    act(() => emit({ type: 'available', version: '2.0.0', highlights: null }))
    expect(screen.getByText('Version 2.0.0 is available.')).toBeInTheDocument()

    act(() => screen.getByRole('button', { name: 'View' }).click())
    expect(screen.queryByText('Version 2.0.0 is available.')).not.toBeInTheDocument()

    // A later background check re-confirming the same update shouldn't bring it back.
    act(() => emit({ type: 'checking' }))
    act(() => emit({ type: 'available', version: '2.0.0', highlights: null }))
    expect(screen.queryByText('Version 2.0.0 is available.')).not.toBeInTheDocument()
  })

  it('does not show a badge or toast for a downgrade candidate (e.g. an unpromoted pre-release)', () => {
    const { container } = render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    act(() =>
      emit({ type: 'available', version: '1.3.0', highlights: null, isDowngrade: true })
    )

    expect(container.querySelector('.app-sidebar-badge')).not.toBeInTheDocument()
    expect(screen.queryByText('Version 1.3.0 is available.')).not.toBeInTheDocument()
  })

  it("renders the update toast outside the sidebar's own DOM subtree", () => {
    // Regression test: .app-sidebar has backdrop-filter, which creates a new
    // containing block for position:fixed descendants - a toast nested
    // inside it was fixed relative to the sidebar itself (bottom-left of the
    // screen) instead of the viewport (bottom-right), where a Toast always
    // means to render (see Toast.css).
    const { container } = render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    act(() => emit({ type: 'available', version: '2.0.0', highlights: null, isDowngrade: false }))

    expect(container.querySelector('.toast')).not.toBeInTheDocument()
    expect(document.body.querySelector('.app-sidebar .toast')).not.toBeInTheDocument()
    expect(document.body.querySelector(':scope > .toast')).toBeInTheDocument()
  })

  it('highlights Gallery when on a media detail page opened without a pending queue', () => {
    render(
      <MemoryRouter initialEntries={['/media/abc']}>
        <AppHeader />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Gallery' })).toHaveClass('active')
    expect(screen.getByRole('link', { name: 'Pending' })).not.toHaveClass('active')
  })

  it('highlights Pending when on a media detail page opened from the pending queue', () => {
    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/media/abc', state: { pendingQueue: true } }]}
      >
        <AppHeader />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Pending' })).toHaveClass('active')
    expect(screen.getByRole('link', { name: 'Gallery' })).not.toHaveClass('active')
  })

  it('does not highlight Gallery or Pending on the add-media page', () => {
    render(
      <MemoryRouter initialEntries={['/media/add']}>
        <AppHeader />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Gallery' })).not.toHaveClass('active')
    expect(screen.getByRole('link', { name: 'Pending' })).not.toHaveClass('active')
  })
})
