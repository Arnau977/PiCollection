// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationsSection } from './NotificationsSection'

describe('NotificationsSection', () => {
  it('lists every alert switched on, and turns one off', async () => {
    const setEnabled = vi.fn().mockResolvedValue({ success: true, data: ['missing-files'] })
    Object.defineProperty(window, 'api', {
      value: {
        notifications: {
          getDisabled: vi.fn().mockResolvedValue({ success: true, data: [] }),
          setEnabled
        }
      },
      writable: true,
      configurable: true
    })
    render(<NotificationsSection />)

    await waitFor(() => screen.getAllByRole('checkbox').forEach((box) => expect(box).toBeChecked()))
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Missing files' }))
    expect(setEnabled).toHaveBeenCalledWith('missing-files', false)
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Missing files' })).not.toBeChecked()
    )
  })
})
