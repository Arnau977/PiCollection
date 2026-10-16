// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutoImportRow } from './AutoImportRow'

describe('AutoImportRow', () => {
  it('starts off and turns auto-import on', async () => {
    const setEnabled = vi
      .fn()
      .mockResolvedValue({ success: true, data: { autoImport: true, autoImportEnabledAt: 1 } })
    Object.defineProperty(window, 'api', {
      value: {
        autoImport: {
          getSettings: vi.fn().mockResolvedValue({
            success: true,
            data: { autoImport: false, autoImportEnabledAt: null }
          }),
          setEnabled
        }
      },
      writable: true,
      configurable: true
    })
    render(<AutoImportRow />)

    const box = await screen.findByRole('checkbox', {
      name: 'Add new files to Pending automatically'
    })
    await waitFor(() => expect(box).toBeEnabled())
    expect(box).not.toBeChecked()

    await userEvent.click(box)
    expect(setEnabled).toHaveBeenCalledWith(true)
    await waitFor(() => expect(box).toBeChecked())
  })
})
