// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import SettingsPage from './SettingsPage'
import { loadGalleryDefaults } from '../../utils/gallerySettings'

vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true)
}))

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string): Promise<void> {
  await user.click(screen.getByRole('tab', { name }))
}

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'api', {
    value: {
      system: { getAppVersion: vi.fn().mockResolvedValue({ success: true, data: '1.0.0' }) },
      sauceNao: {
        getApiKey: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        setApiKey: vi.fn().mockResolvedValue({ success: true, data: undefined })
      },
      updater: {
        getChannel: vi.fn().mockResolvedValue({ success: true, data: 'stable' }),
        setChannel: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        checkForUpdates: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        downloadUpdate: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        quitAndInstall: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        getStatus: vi.fn().mockResolvedValue({ success: true, data: null }),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      backup: {
        export: vi.fn().mockResolvedValue({ success: true, data: { cancelled: true } }),
        import: vi.fn().mockResolvedValue({ success: true, data: { cancelled: true } })
      },
      maintenance: {
        checkMissingFiles: vi.fn().mockResolvedValue({
          success: true,
          data: { totalCount: 0, missingCount: 0, suggestedOldRoot: null }
        }),
        pickFolder: vi.fn(),
        relinkMissingFiles: vi.fn()
      },
      sourceFolder: {
        get: vi.fn().mockResolvedValue({ success: true, data: null }),
        scanMigration: vi.fn(),
        applyMigration: vi.fn()
      },
      logging: {
        getEnabled: vi.fn().mockResolvedValue({ success: true, data: false }),
        setEnabled: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        openFolder: vi.fn().mockResolvedValue({ success: true, data: undefined })
      },
      wd14Runtime: {
        getStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'not-installed' } }),
        install: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        remove: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        onEvent: vi.fn().mockReturnValue(() => {})
      }
    },
    writable: true,
    configurable: true
  })
})

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('SettingsPage', () => {
  it('reflects the current language selection', () => {
    render(<SettingsPage />)
    expect(screen.getByLabelText('English')).toBeChecked()
    expect(screen.getByLabelText('Spanish')).not.toBeChecked()
  })

  it('changes the app language when a different language is picked', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.click(screen.getByLabelText('Spanish'))

    expect(i18n.language).toBe('es')
  })

  it('persists a change to the default SFW filter', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Filters')

    await user.selectOptions(screen.getByLabelText('SFW'), 'sfw')

    expect(loadGalleryDefaults().sfw).toBe(true)
  })

  it('persists a change to the default sort direction', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Filters')

    expect(screen.getByRole('button', { name: 'Descending' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Descending' }))

    expect(loadGalleryDefaults().sortDesc).toBe(false)
    expect(screen.getByRole('button', { name: 'Ascending' })).toBeInTheDocument()
  })

  it('defaults NSFW blur to enabled and persists a change', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    const blurCheckbox = screen.getByRole('checkbox', { name: /blurred/i })
    expect(blurCheckbox).toBeChecked()

    await user.click(blurCheckbox)

    expect(loadGalleryDefaults().blurNsfw).toBe(false)
  })

  it('defaults hide names to disabled and persists a change', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    const hideNamesCheckbox = screen.getByRole('checkbox', { name: /hide each media/i })
    expect(hideNamesCheckbox).not.toBeChecked()

    await user.click(hideNamesCheckbox)

    expect(loadGalleryDefaults().hideNames).toBe(true)
  })

  it('shows the current app version and lets the user check for updates', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Advanced')

    await waitFor(() => expect(screen.getByText('Current version: 1.0.0')).toBeInTheDocument())
    expect(screen.getByLabelText(/^Stable/)).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Check for updates' }))

    expect(window.api.updater.checkForUpdates).toHaveBeenCalled()
  })

  it('switches the update channel and persists it via IPC', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Advanced')

    await user.click(screen.getByLabelText(/^Beta/))

    expect(window.api.updater.setChannel).toHaveBeenCalledWith('beta')
  })

  it('loads a previously-saved SauceNAO API key into the field', async () => {
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        sauceNao: {
          getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'saved-key' }),
          setApiKey: vi.fn().mockResolvedValue({ success: true, data: undefined })
        }
      },
      writable: true,
      configurable: true
    })
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Advanced')

    await waitFor(() => expect(screen.getByLabelText('SauceNAO API key')).toHaveValue('saved-key'))
  })

  it('saves the SauceNAO API key when Save is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Advanced')

    await user.type(screen.getByLabelText('SauceNAO API key'), 'my-new-key')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.api.sauceNao.setApiKey).toHaveBeenCalledWith('my-new-key')
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('clears the SauceNAO API key when Clear is clicked', async () => {
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        sauceNao: {
          getApiKey: vi.fn().mockResolvedValue({ success: true, data: 'saved-key' }),
          setApiKey: vi.fn().mockResolvedValue({ success: true, data: undefined })
        }
      },
      writable: true,
      configurable: true
    })
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Advanced')

    await waitFor(() => expect(screen.getByLabelText('SauceNAO API key')).toHaveValue('saved-key'))
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(window.api.sauceNao.setApiKey).toHaveBeenCalledWith(undefined)
    expect(screen.getByLabelText('SauceNAO API key')).toHaveValue('')
  })

  it('renders the backup, missing-files and source-folder sections', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Data')

    expect(screen.getByRole('heading', { name: 'Backup & Restore' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Missing files' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Source folder' })).toBeInTheDocument()
  })

  it('defaults debug logging to disabled and enables it via the checkbox', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Advanced')

    const loggingCheckbox = await screen.findByRole('checkbox', { name: 'Enable debug logging' })
    expect(loggingCheckbox).not.toBeChecked()

    await user.click(loggingCheckbox)

    expect(window.api.logging.setEnabled).toHaveBeenCalledWith(true)
  })

  it('opens the logs folder when the button is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Advanced')

    await user.click(screen.getByRole('button', { name: 'Open logs folder' }))

    expect(window.api.logging.openFolder).toHaveBeenCalled()
  })

  it('shows highlights inline when an update becomes available', async () => {
    let emit: (event: unknown) => void = () => {}
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        updater: {
          ...window.api.updater,
          onEvent: vi.fn((listener: (event: unknown) => void) => {
            emit = listener
            return () => {}
          })
        }
      },
      writable: true,
      configurable: true
    })

    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Advanced')

    act(() =>
      emit({
        type: 'available',
        version: '2.0.0',
        highlights: '- New series filters\n- Fixed duplicate detection'
      })
    )

    expect(screen.getByText('New series filters')).toBeInTheDocument()
    expect(screen.getByText('Fixed duplicate detection')).toBeInTheDocument()
  })

  it('shows no highlights block when the release has none', async () => {
    let emit: (event: unknown) => void = () => {}
    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        updater: {
          ...window.api.updater,
          onEvent: vi.fn((listener: (event: unknown) => void) => {
            emit = listener
            return () => {}
          })
        }
      },
      writable: true,
      configurable: true
    })

    const user = userEvent.setup()
    render(<SettingsPage />)
    await openTab(user, 'Advanced')

    act(() => emit({ type: 'available', version: '2.0.0', highlights: null }))

    expect(screen.queryByText("What's new")).not.toBeInTheDocument()
  })
})
