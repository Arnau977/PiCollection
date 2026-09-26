// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AutoBackupStatus } from '@shared/models'
import { useAutoBackup } from '../../hooks/useAutoBackup'
import { AutoBackupRows } from './AutoBackupRows'

const HOUR = 60 * 60 * 1000

function makeStatus(overrides: Partial<AutoBackupStatus> = {}): AutoBackupStatus {
  return {
    enabled: false,
    frequency: 'daily',
    keepCount: 10,
    folder: null,
    resolvedFolder: 'C:\\Users\\me\\AppData\\PiCollection\\backups',
    lastSuccessAt: null,
    lastError: null,
    nextDueAt: null,
    running: false,
    ...overrides
  }
}

function mockApi(initial: AutoBackupStatus) {
  let pushListener: (status: AutoBackupStatus) => void = () => {}
  const api = {
    getStatus: vi.fn().mockResolvedValue({ success: true, data: initial }),
    updateConfig: vi.fn(),
    pickFolder: vi.fn(),
    openFolder: vi.fn(),
    runNow: vi.fn(),
    onChanged: vi.fn((listener: (status: AutoBackupStatus) => void) => {
      pushListener = listener
      return () => {}
    })
  }
  Object.defineProperty(window, 'api', {
    value: { autoBackup: api },
    writable: true,
    configurable: true
  })
  return { api, push: (status: AutoBackupStatus) => act(() => pushListener(status)) }
}

function Harness(): JSX.Element {
  return <AutoBackupRows autoBackup={useAutoBackup()} />
}

describe('AutoBackupRows', () => {
  it('reveals the schedule rows and last/next status once enabled', async () => {
    const { api } = mockApi(makeStatus())
    const lastSuccessAt = Date.now() - 3 * HOUR
    api.updateConfig.mockResolvedValue({
      success: true,
      data: makeStatus({ enabled: true, lastSuccessAt, nextDueAt: lastSuccessAt + 24 * HOUR })
    })
    const user = userEvent.setup()
    render(<Harness />)

    const toggle = await screen.findByRole('checkbox', { name: 'Automatic backups' })
    expect(screen.queryByRole('combobox', { name: 'Frequency' })).not.toBeInTheDocument()

    await user.click(toggle)

    expect(api.updateConfig).toHaveBeenCalledWith({ enabled: true })
    expect(await screen.findByRole('combobox', { name: 'Frequency' })).toHaveValue('daily')
    expect(screen.getByText('Last: 3 hours ago · Next: in 21 hours')).toBeInTheDocument()
    expect(screen.getByText(/\(default\)$/)).toBeInTheDocument()
  })

  it('surfaces a failed run and reflects scheduled runs pushed from main', async () => {
    const { api, push } = mockApi(makeStatus({ enabled: true, lastError: 'EACCES: denied' }))
    api.runNow.mockResolvedValue({ success: true, data: makeStatus({ enabled: true }) })
    const user = userEvent.setup()
    render(<Harness />)

    expect(await screen.findByRole('alert')).toHaveTextContent('EACCES: denied')

    await user.click(screen.getByRole('button', { name: 'Back up now' }))
    expect(api.runNow).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    push(makeStatus({ enabled: true, running: true }))
    expect(screen.getByRole('button', { name: 'Backing up…' })).toBeDisabled()
  })
})
