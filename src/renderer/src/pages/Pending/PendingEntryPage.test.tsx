// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PendingEntryPage from './PendingEntryPage'

function setApi(getOrderedIds: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'api', {
    value: { media: { getOrderedIds } },
    writable: true,
    configurable: true
  })
}

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/pending']}>
      <Routes>
        <Route path="/pending" element={<PendingEntryPage />} />
        <Route path="/media/:id" element={<p>media page for the target id</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PendingEntryPage', () => {
  it('redirects to the first pending media id once loaded', async () => {
    setApi(vi.fn().mockResolvedValue({ success: true, data: ['first', 'second'] }))

    renderPage()

    expect(await screen.findByText('media page for the target id')).toBeInTheDocument()
  })

  it('requests media ordered oldest-first, filtered to pendingTagging: true', async () => {
    const getOrderedIds = vi.fn().mockResolvedValue({ success: true, data: ['first'] })
    setApi(getOrderedIds)

    renderPage()

    await screen.findByText('media page for the target id')
    expect(getOrderedIds).toHaveBeenCalledWith(
      { pendingTagging: true },
      { prop: 'createdAt', desc: false }
    )
  })

  it('shows an all-caught-up message when there are no pending items', async () => {
    setApi(vi.fn().mockResolvedValue({ success: true, data: [] }))

    renderPage()

    expect(await screen.findByText("You're all caught up!")).toBeInTheDocument()
  })

  it('shows the all-caught-up message when the request fails', async () => {
    setApi(vi.fn().mockResolvedValue({ success: false, error: { code: 'INTERNAL', message: 'boom' } }))

    renderPage()

    expect(await screen.findByText("You're all caught up!")).toBeInTheDocument()
  })
})
