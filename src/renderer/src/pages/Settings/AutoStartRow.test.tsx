// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutoStartRow } from './AutoStartRow'

function mockApi(status: { supported: boolean; enabled: boolean }) {
  const setAutoStart = vi
    .fn()
    .mockResolvedValue({ success: true, data: { ...status, enabled: !status.enabled } })
  Object.defineProperty(window, 'api', {
    value: {
      system: {
        getAutoStart: vi.fn().mockResolvedValue({ success: true, data: status }),
        setAutoStart
      }
    },
    writable: true,
    configurable: true
  })
  return setAutoStart
}

describe('AutoStartRow', () => {
  it('toggles starting with Windows', async () => {
    const setAutoStart = mockApi({ supported: true, enabled: false })
    const user = userEvent.setup()
    render(<AutoStartRow />)

    const toggle = screen.getByRole('checkbox', { name: 'Start with Windows' })
    await waitFor(() => expect(toggle).toBeEnabled())
    await user.click(toggle)

    expect(setAutoStart).toHaveBeenCalledWith(true)
    await waitFor(() => expect(toggle).toBeChecked())
  })

  it('disables the toggle and explains why when unsupported', async () => {
    mockApi({ supported: false, enabled: false })
    render(<AutoStartRow />)

    expect(await screen.findByText('Not available in this build of the app.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Start with Windows' })).toBeDisabled()
  })
})
