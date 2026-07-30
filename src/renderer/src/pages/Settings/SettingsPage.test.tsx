// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import SettingsPage from './SettingsPage'
import { loadGalleryDefaults } from '../../utils/gallerySettings'

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'api', {
    value: {
      system: { getAppVersion: vi.fn().mockResolvedValue({ success: true, data: '1.0.0' }) },
      updater: {
        getChannel: vi.fn().mockResolvedValue({ success: true, data: 'stable' }),
        setChannel: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        checkForUpdates: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        downloadUpdate: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        quitAndInstall: vi.fn().mockResolvedValue({ success: true, data: undefined }),
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

    await user.selectOptions(screen.getByLabelText('SFW'), 'sfw')

    expect(loadGalleryDefaults().sfw).toBe(true)
  })

  it('persists a change to the default sort direction', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

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

    await waitFor(() => expect(screen.getByText('Current version: 1.0.0')).toBeInTheDocument())
    expect(screen.getByLabelText(/^Stable/)).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Check for updates' }))

    expect(window.api.updater.checkForUpdates).toHaveBeenCalled()
  })

  it('switches the update channel and persists it via IPC', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.click(screen.getByLabelText(/^Beta/))

    expect(window.api.updater.setChannel).toHaveBeenCalledWith('beta')
  })
})
