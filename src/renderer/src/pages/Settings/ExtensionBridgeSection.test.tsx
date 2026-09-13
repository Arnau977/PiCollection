// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExtensionBridgeSection } from './ExtensionBridgeSection'

function setApi(overrides: Record<string, unknown> = {}): void {
  Object.defineProperty(window, 'api', {
    value: {
      extensionBridge: {
        getStatus: vi.fn().mockResolvedValue({
          success: true,
          data: {
            enabled: false,
            running: false,
            token: null,
            port: 8934,
            backgroundModeEnabled: false
          }
        }),
        setEnabled: vi.fn(),
        setBackgroundMode: vi.fn(),
        regenerateToken: vi.fn(),
        ...overrides
      }
    },
    writable: true,
    configurable: true
  })
}

describe('ExtensionBridgeSection', () => {
  it('shows disabled state with no token by default', async () => {
    setApi()
    render(<ExtensionBridgeSection />)

    expect(
      await screen.findByRole('checkbox', { name: 'Enable browser extension capture' })
    ).not.toBeChecked()
    expect(screen.queryByText('Pairing token')).not.toBeInTheDocument()
  })

  it('enables the bridge and shows the token', async () => {
    setApi({
      setEnabled: vi.fn().mockResolvedValue({
        success: true,
        data: {
          enabled: true,
          running: true,
          token: 'abc123',
          port: 8934,
          backgroundModeEnabled: false
        }
      })
    })
    const user = userEvent.setup()
    render(<ExtensionBridgeSection />)

    await user.click(
      await screen.findByRole('checkbox', { name: 'Enable browser extension capture' })
    )

    expect(window.api.extensionBridge.setEnabled).toHaveBeenCalledWith(true)
    expect(await screen.findByDisplayValue('abc123')).toBeInTheDocument()
  })

  it('regenerates the token', async () => {
    setApi({
      getStatus: vi.fn().mockResolvedValue({
        success: true,
        data: {
          enabled: true,
          running: true,
          token: 'abc123',
          port: 8934,
          backgroundModeEnabled: false
        }
      }),
      regenerateToken: vi.fn().mockResolvedValue({
        success: true,
        data: {
          enabled: true,
          running: true,
          token: 'new-token',
          port: 8934,
          backgroundModeEnabled: false
        }
      })
    })
    const user = userEvent.setup()
    render(<ExtensionBridgeSection />)

    await user.click(await screen.findByRole('button', { name: 'Regenerate token' }))

    expect(await screen.findByDisplayValue('new-token')).toBeInTheDocument()
  })

  it('shows an error and leaves the checkbox reflecting the persisted state when setEnabled fails', async () => {
    setApi({
      setEnabled: vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'PORT_IN_USE', message: 'Port already in use' }
      })
    })
    const user = userEvent.setup()
    render(<ExtensionBridgeSection />)

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Enable browser extension capture'
    })
    await user.click(checkbox)

    expect(await screen.findByRole('alert')).toHaveTextContent('Port already in use')
    expect(checkbox).not.toBeChecked()
    expect(checkbox).not.toBeDisabled()
  })

  it('shows a not-running indicator when enabled but not actually listening', async () => {
    setApi({
      getStatus: vi.fn().mockResolvedValue({
        success: true,
        data: {
          enabled: true,
          running: false,
          token: 'abc123',
          port: 8934,
          backgroundModeEnabled: false
        }
      })
    })
    render(<ExtensionBridgeSection />)

    expect(await screen.findByText('Enabled but not currently running')).toBeInTheDocument()
  })
})
