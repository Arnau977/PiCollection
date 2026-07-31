// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MissingFilesSection } from './MissingFilesSection'

function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      maintenance: {
        checkMissingFiles: vi.fn(),
        pickFolder: vi.fn(),
        relinkMissingFiles: vi.fn(),
        ...overrides
      }
    },
    writable: true,
    configurable: true
  })
}

describe('MissingFilesSection', () => {
  it('shows a clean message when nothing is missing', async () => {
    setApi({
      checkMissingFiles: vi.fn().mockResolvedValue({
        success: true,
        data: { totalCount: 10, missingCount: 0, suggestedOldRoot: null }
      })
    })
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))

    expect(await screen.findByText('All 10 media files found.')).toBeInTheDocument()
  })

  it('pre-fills the suggested old root when files are missing', async () => {
    setApi({
      checkMissingFiles: vi.fn().mockResolvedValue({
        success: true,
        data: { totalCount: 10, missingCount: 3, suggestedOldRoot: 'D:\\Old\\' }
      })
    })
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))

    expect(await screen.findByText('3 of 10 files are missing.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('D:\\Old\\')).toBeInTheDocument()
  })

  it('disables Relink until a new folder is chosen', async () => {
    setApi({
      checkMissingFiles: vi.fn().mockResolvedValue({
        success: true,
        data: { totalCount: 5, missingCount: 5, suggestedOldRoot: null }
      })
    })
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))

    expect(await screen.findByRole('button', { name: 'Relink' })).toBeDisabled()
  })

  function setRelinkableApi(): void {
    setApi({
      checkMissingFiles: vi.fn().mockResolvedValue({
        success: true,
        data: { totalCount: 5, missingCount: 5, suggestedOldRoot: 'D:\\Old\\' }
      }),
      pickFolder: vi
        .fn()
        .mockResolvedValue({ success: true, data: { cancelled: false, path: 'E:\\New\\' } }),
      relinkMissingFiles: vi
        .fn()
        .mockResolvedValue({ success: true, data: { updatedCount: 5, stillMissingCount: 0 } })
    })
  }

  it('relinks after picking a new folder and shows the result', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setRelinkableApi()
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))
    await user.click(await screen.findByRole('button', { name: 'Choose new folder...' }))
    await user.click(await screen.findByRole('button', { name: 'Relink' }))

    expect(window.api.maintenance.relinkMissingFiles).toHaveBeenCalledWith('D:\\Old\\', 'E:\\New\\')
    expect(await screen.findByText('Relinked 5 files. 0 still missing.')).toBeInTheDocument()
  })

  it('asks for confirmation before relinking, and does nothing if declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    setRelinkableApi()
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))
    await user.click(await screen.findByRole('button', { name: 'Choose new folder...' }))
    await user.click(await screen.findByRole('button', { name: 'Relink' }))

    expect(window.api.maintenance.relinkMissingFiles).not.toHaveBeenCalled()
    expect(screen.queryByText('Relinked 5 files. 0 still missing.')).not.toBeInTheDocument()
  })

  it('shows the chosen folder as its own line, leaving the button label unchanged', async () => {
    setRelinkableApi()
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))
    await user.click(await screen.findByRole('button', { name: 'Choose new folder...' }))

    expect(await screen.findByText('New folder: E:\\New\\')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose new folder...' })).toBeInTheDocument()
  })
})
