// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackupSection } from './BackupSection'

function setApi(overrides: Record<string, Record<string, unknown>> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      backup: {
        export: vi.fn().mockResolvedValue({ success: true, data: { cancelled: false } }),
        import: vi.fn().mockResolvedValue({ success: true, data: { cancelled: false } }),
        ...overrides.backup
      },
      system: {
        restartApp: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        ...overrides.system
      }
    },
    writable: true,
    configurable: true
  })
}

beforeEach(() => {
  setApi()
  window.localStorage.clear()
})

describe('BackupSection', () => {
  it('exports and shows a success message', async () => {
    const user = userEvent.setup()
    render(<BackupSection />)

    await user.click(screen.getByRole('button', { name: 'Export...' }))

    expect(window.api.backup.export).toHaveBeenCalled()
    expect(await screen.findByText('Backup exported.')).toBeInTheDocument()
  })

  it('does not show a success message when export is cancelled', async () => {
    setApi({ backup: { export: vi.fn().mockResolvedValue({ success: true, data: { cancelled: true } }) } })
    const user = userEvent.setup()
    render(<BackupSection />)

    await user.click(screen.getByRole('button', { name: 'Export...' }))

    expect(screen.queryByText('Backup exported.')).not.toBeInTheDocument()
  })

  it('shows an error message when export fails', async () => {
    setApi({
      backup: {
        export: vi
          .fn()
          .mockResolvedValue({ success: false, error: { code: 'INTERNAL', message: 'Disk full' } })
      }
    })
    const user = userEvent.setup()
    render(<BackupSection />)

    await user.click(screen.getByRole('button', { name: 'Export...' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full')
  })

  it('asks for confirmation before importing, and does nothing if declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<BackupSection />)

    await user.click(screen.getByRole('button', { name: 'Import...' }))

    expect(window.api.backup.import).not.toHaveBeenCalled()
  })

  it('imports, saves the returned gallery settings, and prompts to restart', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setApi({
      backup: {
        import: vi.fn().mockResolvedValue({
          success: true,
          data: { cancelled: false, gallerySettings: { density: 'compact' } }
        })
      }
    })
    const user = userEvent.setup()
    render(<BackupSection />)

    await user.click(screen.getByRole('button', { name: 'Import...' }))

    expect(await screen.findByRole('button', { name: 'Restart now' })).toBeInTheDocument()
    expect(
      JSON.parse(window.localStorage.getItem('picollection:gallery-defaults') as string)
    ).toMatchObject({ density: 'compact' })
  })

  it('restarts the app when the restart button is clicked', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<BackupSection />)

    await user.click(screen.getByRole('button', { name: 'Import...' }))
    await user.click(await screen.findByRole('button', { name: 'Restart now' }))

    expect(window.api.system.restartApp).toHaveBeenCalled()
  })
})
