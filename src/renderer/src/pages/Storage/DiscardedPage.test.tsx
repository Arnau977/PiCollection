// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PATH } from '../../app.routes.const'
import DiscardedPage from './DiscardedPage'

vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => vi.fn()
}))

describe('DiscardedPage', () => {
  it('lists the discarded files under Disk space and goes back to it', async () => {
    Object.defineProperty(window, 'api', {
      value: { discardedMedia: { list: vi.fn().mockResolvedValue({ success: true, data: [] }) } },
      configurable: true
    })
    render(
      <MemoryRouter initialEntries={[PATH.DISCARDED]}>
        <Routes>
          <Route path={PATH.DISCARDED} element={<DiscardedPage />} />
          <Route path={PATH.STORAGE} element={<p>disk space page</p>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Nothing discarded')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Discarded' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Back to Disk space' }))

    expect(screen.getByText('disk space page')).toBeInTheDocument()
  })
})
