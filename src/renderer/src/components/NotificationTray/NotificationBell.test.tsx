// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { AppNotification } from '@shared/models'
import { NotificationBell } from './NotificationBell'

const pending: AppNotification = {
  kind: 'pending-stale',
  severity: 'info',
  snoozable: true,
  count: 3,
  since: Date.now() - 9 * 24 * 60 * 60 * 1000
}
const failed: AppNotification = { kind: 'backup-failed', severity: 'attention', snoozable: false }

function setApi(items: AppNotification[]): ReturnType<typeof vi.fn> {
  const snooze = vi.fn().mockResolvedValue({ success: true, data: [failed] })
  Object.defineProperty(window, 'api', {
    value: {
      notifications: {
        getAll: vi.fn().mockResolvedValue({ success: true, data: items }),
        snooze,
        onChanged: vi.fn().mockReturnValue(() => {})
      }
    },
    writable: true,
    configurable: true
  })
  return snooze
}

function LocationProbe(): JSX.Element {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + JSON.stringify(location.state)}</p>
}

function renderBell(): void {
  render(
    <MemoryRouter>
      <NotificationBell />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('NotificationBell', () => {
  it('says when there is nothing waiting', async () => {
    setApi([])
    renderBell()
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByText("You're all caught up")).toBeInTheDocument()
  })

  it('names the count, navigates with a row action and snoozes', async () => {
    const snooze = setApi([failed, pending])
    renderBell()
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 pending' }))

    expect(screen.getByText('3 media waiting in Pending')).toBeInTheDocument()
    // A failed backup can't be snoozed, so only one snooze button.
    await userEvent.click(screen.getByRole('button', { name: 'Snooze for 7 days' }))
    expect(snooze).toHaveBeenCalledWith('pending-stale')
    await waitFor(() =>
      expect(screen.queryByText('3 media waiting in Pending')).not.toBeInTheDocument()
    )

    await userEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/settings{"settingsTab":"data"}')
  })
})

describe('NotificationBell new files', () => {
  it('offers "Mark as seen" instead of a snooze for new source-folder files', async () => {
    setApi([{ kind: 'source-folder-new', severity: 'info', snoozable: true, count: 2 }])
    renderBell()
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 pending' }))

    expect(screen.getByRole('button', { name: 'Mark as seen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Snooze for 7 days' })).not.toBeInTheDocument()
  })
})
