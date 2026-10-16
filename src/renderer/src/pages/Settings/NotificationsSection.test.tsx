// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ALERT_DEFAULTS } from '@shared/models'
import { NotificationsSection } from './NotificationsSection'

describe('NotificationsSection', () => {
  it('shows each switch as saved (no switch for updates), and turns one on', async () => {
    const setEnabled = vi
      .fn()
      .mockResolvedValue({ success: true, data: { ...ALERT_DEFAULTS, 'missing-files': true } })
    Object.defineProperty(window, 'api', {
      value: {
        notifications: {
          getAlerts: vi.fn().mockResolvedValue({ success: true, data: ALERT_DEFAULTS }),
          setEnabled
        }
      },
      writable: true,
      configurable: true
    })
    render(<NotificationsSection />)

    const backupFailed = await screen.findByRole('checkbox', { name: 'Failed automatic backup' })
    await waitFor(() => expect(backupFailed).toBeChecked())
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)
    expect(screen.queryByRole('checkbox', { name: 'Updates' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Missing files' })).not.toBeChecked()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Missing files' }))
    expect(setEnabled).toHaveBeenCalledWith('missing-files', true)
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Missing files' })).toBeChecked()
    )
  })
})
