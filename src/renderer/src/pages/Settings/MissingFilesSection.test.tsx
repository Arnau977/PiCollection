// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MissingFilesSection } from './MissingFilesSection'

const confirmMock = vi.fn().mockResolvedValue(true)

vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => confirmMock
}))

function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      maintenance: {
        checkMissingFiles: vi.fn(),
        pickFolder: vi.fn(),
        pickFile: vi.fn(),
        relinkMissingFiles: vi.fn(),
        relinkOne: vi.fn(),
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
        data: { totalCount: 10, missingCount: 0, suggestedOldRoot: null, missingItems: [] }
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
        data: {
          totalCount: 10,
          missingCount: 3,
          suggestedOldRoot: 'D:\\Old\\',
          missingItems: [{ id: '1', name: 'a', route: 'D:\\Old\\a.png', type: 'image' }]
        }
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
        data: { totalCount: 5, missingCount: 5, suggestedOldRoot: null, missingItems: [] }
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
        data: { totalCount: 5, missingCount: 5, suggestedOldRoot: 'D:\\Old\\', missingItems: [] }
      }),
      pickFolder: vi
        .fn()
        .mockResolvedValue({ success: true, data: { cancelled: false, path: 'E:\\New\\' } }),
      relinkMissingFiles: vi
        .fn()
        .mockResolvedValue({ success: true, data: { updatedCount: 5, stillMissingCount: 0 } })
    })
  }

  it('relinks after picking a new folder and refreshes to the clean state', async () => {
    // Unlike the other tests sharing setRelinkableApi(), this one needs the
    // *second* checkMissingFiles call (the post-relink refresh) to report
    // clean - a plain mockResolvedValue would return "still 5 missing"
    // forever and the component would never reach the clean state.
    confirmMock.mockResolvedValueOnce(true)
    setApi({
      checkMissingFiles: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          data: { totalCount: 5, missingCount: 5, suggestedOldRoot: 'D:\\Old\\', missingItems: [] }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { totalCount: 5, missingCount: 0, suggestedOldRoot: null, missingItems: [] }
        }),
      pickFolder: vi
        .fn()
        .mockResolvedValue({ success: true, data: { cancelled: false, path: 'E:\\New\\' } }),
      relinkMissingFiles: vi
        .fn()
        .mockResolvedValue({ success: true, data: { updatedCount: 5, stillMissingCount: 0 } })
    })
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))
    await user.click(await screen.findByRole('button', { name: 'Choose new folder...' }))
    await user.click(await screen.findByRole('button', { name: 'Relink' }))

    expect(window.api.maintenance.relinkMissingFiles).toHaveBeenCalledWith('D:\\Old\\', 'E:\\New\\')
    expect(window.api.maintenance.checkMissingFiles).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('All 5 media files found.')).toBeInTheDocument()
  })

  it('asks for confirmation before relinking, and does nothing if declined', async () => {
    confirmMock.mockResolvedValueOnce(false)
    setRelinkableApi()
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))
    await user.click(await screen.findByRole('button', { name: 'Choose new folder...' }))
    await user.click(await screen.findByRole('button', { name: 'Relink' }))

    expect(window.api.maintenance.relinkMissingFiles).not.toHaveBeenCalled()
    expect(window.api.maintenance.checkMissingFiles).toHaveBeenCalledTimes(1)
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

  it('lists individual missing files with a per-item relink action', async () => {
    setApi({
      checkMissingFiles: vi.fn().mockResolvedValue({
        success: true,
        data: {
          totalCount: 2,
          missingCount: 2,
          suggestedOldRoot: null,
          missingItems: [
            { id: 'a', name: 'Cat photo', route: 'C:\\Old\\cat.png', type: 'image' },
            { id: 'b', name: 'Dog photo', route: 'C:\\Old\\dog.png', type: 'image' }
          ]
        }
      })
    })
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))

    expect(await screen.findByText('Cat photo')).toBeInTheDocument()
    expect(screen.getByText('C:\\Old\\cat.png')).toBeInTheDocument()
    expect(screen.getByText('Dog photo')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Choose new file...' })).toHaveLength(2)
  })

  it('relinks a single item, removes it from the list, and updates the count', async () => {
    setApi({
      checkMissingFiles: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          data: {
            totalCount: 2,
            missingCount: 2,
            suggestedOldRoot: null,
            missingItems: [
              { id: 'a', name: 'Cat photo', route: 'C:\\Old\\cat.png', type: 'image' },
              { id: 'b', name: 'Dog photo', route: 'C:\\Old\\dog.png', type: 'image' }
            ]
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            totalCount: 2,
            missingCount: 1,
            suggestedOldRoot: null,
            missingItems: [{ id: 'b', name: 'Dog photo', route: 'C:\\Old\\dog.png', type: 'image' }]
          }
        }),
      pickFile: vi
        .fn()
        .mockResolvedValue({ success: true, data: { cancelled: false, path: 'C:\\New\\cat.png' } }),
      relinkOne: vi.fn().mockResolvedValue({ success: true, data: { updated: true } })
    })
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))
    const catRow = (await screen.findByText('Cat photo')).closest('li')!
    await user.click(within(catRow).getByRole('button', { name: 'Choose new file...' }))

    expect(window.api.maintenance.relinkOne).toHaveBeenCalledWith('a', 'C:\\New\\cat.png')
    expect(await screen.findByText('1 of 2 files are missing.')).toBeInTheDocument()
    expect(screen.queryByText('Cat photo')).not.toBeInTheDocument()
    expect(screen.getByText('Dog photo')).toBeInTheDocument()
  })

  it('preserves the in-progress bulk relink form when a single item is relinked', async () => {
    setApi({
      checkMissingFiles: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          data: {
            totalCount: 2,
            missingCount: 2,
            suggestedOldRoot: 'D:\\Old\\',
            missingItems: [
              { id: 'a', name: 'Cat photo', route: 'C:\\Old\\cat.png', type: 'image' },
              { id: 'b', name: 'Dog photo', route: 'C:\\Old\\dog.png', type: 'image' }
            ]
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            totalCount: 2,
            missingCount: 1,
            // Deliberately different from what's typed in the form, and from
            // the first suggestion, so a wipe-and-reset would be detectable.
            suggestedOldRoot: 'F:\\SomethingElse\\',
            missingItems: [{ id: 'b', name: 'Dog photo', route: 'C:\\Old\\dog.png', type: 'image' }]
          }
        }),
      pickFolder: vi
        .fn()
        .mockResolvedValue({ success: true, data: { cancelled: false, path: 'E:\\New\\' } }),
      pickFile: vi
        .fn()
        .mockResolvedValue({ success: true, data: { cancelled: false, path: 'C:\\New\\cat.png' } }),
      relinkOne: vi.fn().mockResolvedValue({ success: true, data: { updated: true } })
    })
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))

    // Arm the bulk relink form: type a custom old root and pick a new folder.
    const oldRootInput = await screen.findByDisplayValue('D:\\Old\\')
    await user.clear(oldRootInput)
    await user.type(oldRootInput, 'Custom\\Old\\')
    await user.click(screen.getByRole('button', { name: 'Choose new folder...' }))
    expect(await screen.findByText('New folder: E:\\New\\')).toBeInTheDocument()

    // Now relink a single renamed file from the list below.
    const catRow = screen.getByText('Cat photo').closest('li')!
    await user.click(within(catRow).getByRole('button', { name: 'Choose new file...' }))

    expect(await screen.findByText('1 of 2 files are missing.')).toBeInTheDocument()
    // The bulk form's typed old root and picked new folder must survive the
    // per-item relink refresh, not be wiped back to the fresh suggestion.
    expect(screen.getByDisplayValue('Custom\\Old\\')).toBeInTheDocument()
    expect(screen.getByText('New folder: E:\\New\\')).toBeInTheDocument()
  })

  it('does nothing when the file picker is cancelled', async () => {
    setApi({
      checkMissingFiles: vi.fn().mockResolvedValue({
        success: true,
        data: {
          totalCount: 1,
          missingCount: 1,
          suggestedOldRoot: null,
          missingItems: [{ id: 'a', name: 'Cat photo', route: 'C:\\Old\\cat.png', type: 'image' }]
        }
      }),
      pickFile: vi.fn().mockResolvedValue({ success: true, data: { cancelled: true } })
    })
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))
    await user.click(await screen.findByRole('button', { name: 'Choose new file...' }))

    expect(window.api.maintenance.relinkOne).not.toHaveBeenCalled()
    expect(screen.getByText('Cat photo')).toBeInTheDocument()
  })

  it('tells the user more files are missing than are listed, when the list is capped', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      id: `id-${i}`,
      name: `Photo ${i}`,
      route: `C:\\Old\\${i}.png`,
      type: 'image' as const
    }))
    setApi({
      checkMissingFiles: vi.fn().mockResolvedValue({
        success: true,
        data: { totalCount: 60, missingCount: 55, suggestedOldRoot: null, missingItems: items }
      })
    })
    const user = userEvent.setup()
    render(<MissingFilesSection />)

    await user.click(screen.getByRole('button', { name: 'Check for missing files' }))

    expect(
      await screen.findByText('+52 more not shown - use the folder relink above for large batches.')
    ).toBeInTheDocument()
  })
})
