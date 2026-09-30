// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DiscardedMediaModel } from '@shared/models'
import { DiscardedManager } from './DiscardedManager'

const confirmMock = vi.fn()
vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => confirmMock
}))

function discarded(id: string, route: string): DiscardedMediaModel {
  return { id, route, name: id, type: 'image', reason: 'deleted', discardedAt: 0 }
}

describe('DiscardedManager', () => {
  it('moves every listed file to the Recycle Bin in one call, after confirming', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [discarded('d1', 'art/a.png'), discarded('d2', 'b.png')]
      })
      .mockResolvedValue({ success: true, data: [] })
    const trashFiles = vi.fn().mockResolvedValue({ success: true, data: { trashed: 2, failed: 0 } })
    Object.defineProperty(window, 'api', {
      value: { discardedMedia: { list, trashFiles, keepFile: vi.fn() } },
      configurable: true
    })
    confirmMock.mockResolvedValue(true)
    const user = userEvent.setup()
    render(<DiscardedManager />)

    expect(await screen.findByText('a.png')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Move all 2 to the Recycle Bin' }))

    expect(trashFiles).toHaveBeenCalledTimes(1)
    expect(trashFiles).toHaveBeenCalledWith(['d1', 'd2'])
    expect(await screen.findByText('Nothing discarded')).toBeInTheDocument()
  })
})
