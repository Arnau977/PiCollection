// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { StorageOverview } from '@shared/models'
import { PATH } from '../../app.routes.const'
import StoragePage from './StoragePage'

const empty = { bytes: 0, count: 0 }
const overview = {
  library: { ...empty, unmeasured: 0, byType: { image: empty, gif: empty, video: empty } },
  pending: empty,
  discarded: empty,
  disk: null,
  folders: [],
  files: [],
  series: [],
  characters: [],
  artists: [],
  tags: [],
  without: { series: empty, characters: empty, artists: empty }
} as unknown as StorageOverview

vi.mock('../../hooks/useStorageOverview', () => ({
  useStorageOverview: () => ({ data: overview, loading: false, error: null, refetch: vi.fn() })
}))
vi.mock('../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => vi.fn()
}))

describe('StoragePage', () => {
  // The card counts files still on disk, the list every record: one whose file
  // was removed by hand counts for nothing here but must stay reachable.
  it('links to Discarded even when no reclaimable file is left', () => {
    render(
      <MemoryRouter>
        <StoragePage />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Review files' })).toHaveAttribute(
      'href',
      PATH.DISCARDED
    )
  })
})
