// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourceFolderSection } from './SourceFolderSection'

function setApi(overrides: {
  sourceFolder?: Record<string, unknown>
  maintenance?: Record<string, unknown>
} = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      sourceFolder: {
        get: vi.fn().mockResolvedValue({ success: true, data: null }),
        scanMigration: vi.fn(),
        applyMigration: vi.fn(),
        ...overrides.sourceFolder
      },
      maintenance: {
        pickFolder: vi.fn(),
        ...overrides.maintenance
      }
    },
    writable: true,
    configurable: true
  })
}

describe('SourceFolderSection', () => {
  it('shows no folder configured initially, with no clear button', async () => {
    setApi()
    render(<SourceFolderSection />)

    expect(
      await screen.findByText('No source folder configured - paths are stored as-is (absolute).')
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear source folder' })).not.toBeInTheDocument()
  })

  it('shows the current folder and a clear button when one is configured', async () => {
    setApi({
      sourceFolder: { get: vi.fn().mockResolvedValue({ success: true, data: 'D:\\Fotos' }) }
    })
    render(<SourceFolderSection />)

    expect(await screen.findByText('Current: D:\\Fotos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear source folder' })).toBeInTheDocument()
  })

  it('scans and shows a plan after picking a new folder', async () => {
    setApi({
      maintenance: {
        pickFolder: vi
          .fn()
          .mockResolvedValue({ success: true, data: { cancelled: false, path: 'D:\\Fotos' } })
      },
      sourceFolder: {
        scanMigration: vi.fn().mockResolvedValue({
          success: true,
          data: {
            relocatedCount: 3,
            warnItems: [
              {
                id: 'a',
                name: 'pic',
                route: 'E:\\pic.png',
                plannedRoute: 'E:\\pic.png',
                wasRelative: false
              }
            ],
            warnedCount: 1
          }
        })
      }
    })
    const user = userEvent.setup()
    render(<SourceFolderSection />)

    await user.click(await screen.findByRole('button', { name: 'Choose folder...' }))

    expect(window.api.sourceFolder.scanMigration).toHaveBeenCalledWith('D:\\Fotos')
    expect(
      await screen.findByText('3 files will be stored relative to this folder. 1 files fall outside it and will use an absolute path.')
    ).toBeInTheDocument()
    expect(screen.getByText('pic')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
  })

  it('applies the migration after confirmation and shows the result', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setApi({
      maintenance: {
        pickFolder: vi
          .fn()
          .mockResolvedValue({ success: true, data: { cancelled: false, path: 'D:\\Fotos' } })
      },
      sourceFolder: {
        scanMigration: vi
          .fn()
          .mockResolvedValue({ success: true, data: { relocatedCount: 3, warnItems: [], warnedCount: 0 } }),
        applyMigration: vi
          .fn()
          .mockResolvedValue({ success: true, data: { relocatedCount: 3, warnedCount: 0 } })
      }
    })
    const user = userEvent.setup()
    render(<SourceFolderSection />)

    await user.click(await screen.findByRole('button', { name: 'Choose folder...' }))
    await user.click(await screen.findByRole('button', { name: 'Apply' }))

    expect(window.api.sourceFolder.applyMigration).toHaveBeenCalledWith('D:\\Fotos')
    expect(
      await screen.findByText('Done. 3 files now relative, 0 left absolute.')
    ).toBeInTheDocument()
  })

  it('does nothing when apply is not confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    setApi({
      maintenance: {
        pickFolder: vi
          .fn()
          .mockResolvedValue({ success: true, data: { cancelled: false, path: 'D:\\Fotos' } })
      },
      sourceFolder: {
        scanMigration: vi
          .fn()
          .mockResolvedValue({ success: true, data: { relocatedCount: 3, warnItems: [], warnedCount: 0 } })
      }
    })
    const user = userEvent.setup()
    render(<SourceFolderSection />)

    await user.click(await screen.findByRole('button', { name: 'Choose folder...' }))
    await user.click(await screen.findByRole('button', { name: 'Apply' }))

    expect(window.api.sourceFolder.applyMigration).not.toHaveBeenCalled()
  })

  it('cancel returns to the idle view without applying', async () => {
    setApi({
      maintenance: {
        pickFolder: vi
          .fn()
          .mockResolvedValue({ success: true, data: { cancelled: false, path: 'D:\\Fotos' } })
      },
      sourceFolder: {
        scanMigration: vi
          .fn()
          .mockResolvedValue({ success: true, data: { relocatedCount: 3, warnItems: [], warnedCount: 0 } })
      }
    })
    const user = userEvent.setup()
    render(<SourceFolderSection />)

    await user.click(await screen.findByRole('button', { name: 'Choose folder...' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
    expect(window.api.sourceFolder.applyMigration).not.toHaveBeenCalled()
  })

  it('scans for clearing the source folder', async () => {
    setApi({
      sourceFolder: {
        get: vi.fn().mockResolvedValue({ success: true, data: 'D:\\Fotos' }),
        scanMigration: vi
          .fn()
          .mockResolvedValue({ success: true, data: { relocatedCount: 0, warnItems: [], warnedCount: 5 } })
      }
    })
    const user = userEvent.setup()
    render(<SourceFolderSection />)

    await user.click(await screen.findByRole('button', { name: 'Clear source folder' }))

    expect(window.api.sourceFolder.scanMigration).toHaveBeenCalledWith(null)
    expect(
      await screen.findByText('0 files will be stored relative to this folder. 5 files fall outside it and will use an absolute path.')
    ).toBeInTheDocument()
  })

  it('does nothing when the folder picker is cancelled', async () => {
    setApi({
      maintenance: { pickFolder: vi.fn().mockResolvedValue({ success: true, data: { cancelled: true } }) }
    })
    const user = userEvent.setup()
    render(<SourceFolderSection />)

    await user.click(await screen.findByRole('button', { name: 'Choose folder...' }))

    expect(window.api.sourceFolder.scanMigration).not.toHaveBeenCalled()
  })
})
