// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { FilterListModel, MediaFilters } from '@shared/models'
import { beginListEdit, hasListEditChanges } from '../pages/Gallery/listEdit'
import { readGallerySession, resetGallerySession, writeGallerySession } from './useGallerySession'
import { useOpenInGallery } from './useOpenInGallery'

const confirm = vi.fn()
const navigate = vi.fn()

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => confirm
}))

const list = (id: string): FilterListModel => ({
  id,
  name: id,
  filters: { tagGroups: [['a']] },
  includedListIds: [],
  hasMissingEntities: false,
  createdAt: 1,
  updatedAt: 1
})

function editing(id: string, change: (filters: MediaFilters) => MediaFilters = (f) => f): void {
  const opened = beginListEdit(list(id), { filterListIds: [id] }, {})
  writeGallerySession({
    filters: change(opened.filters),
    listEdit: opened.listEdit,
    sorting: { prop: 'createdAt', desc: true },
    page: 0
  })
}

const withTag = (filters: MediaFilters): MediaFilters => ({ ...filters, tagGroups: [['a', 'b']] })

describe('useOpenInGallery', () => {
  beforeEach(() => {
    resetGallerySession()
    confirm.mockReset()
    navigate.mockReset()
  })

  it('stays in a changed edit when the user keeps editing', async () => {
    editing('Apta', withTag)
    confirm.mockResolvedValue(false)
    const { result } = renderHook(() => useOpenInGallery())

    await result.current.openFiltered({ type: ['gif'] })

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ danger: true, message: expect.stringContaining('Apta') })
    )
    expect(readGallerySession()?.listEdit?.id).toBe('Apta')
    expect(readGallerySession()?.filters.tagGroups).toEqual([['a', 'b']])
    expect(navigate).not.toHaveBeenCalled()
  })

  it('replaces a changed edit once the user discards it', async () => {
    editing('Apta', withTag)
    confirm.mockResolvedValue(true)
    const { result } = renderHook(() => useOpenInGallery())

    await result.current.openEntity('tag', 'x')

    expect(readGallerySession()?.listEdit).toBeUndefined()
    expect(readGallerySession()?.filters.tagGroups).toEqual([['x']])
    expect(navigate).toHaveBeenCalled()
  })

  it('asks nothing when there is nothing to lose', async () => {
    editing('Apta')
    const { result } = renderHook(() => useOpenInGallery())

    await result.current.openFiltered({ type: ['gif'] })

    expect(confirm).not.toHaveBeenCalled()
    expect(readGallerySession()?.listEdit).toBeUndefined()
  })

  it('goes back to the edit already open for that list, changes included', async () => {
    editing('Apta', withTag)
    const { result } = renderHook(() => useOpenInGallery())

    await result.current.openListEdit(list('Apta'))

    expect(confirm).not.toHaveBeenCalled()
    expect(readGallerySession()?.filters.tagGroups).toEqual([['a', 'b']])
    expect(navigate).toHaveBeenCalled()
  })

  it('asks before opening a different list for editing', async () => {
    editing('Apta', withTag)
    confirm.mockResolvedValue(true)
    const { result } = renderHook(() => useOpenInGallery())

    await result.current.openListEdit(list('Otra'))

    expect(confirm).toHaveBeenCalled()
    expect(readGallerySession()?.listEdit?.id).toBe('Otra')
  })
})

describe('hasListEditChanges', () => {
  it('sees no change once a filter added is taken out again', () => {
    const { filters, listEdit } = beginListEdit(list('Apta'), { filterListIds: ['Apta'] }, {})
    const changed = { ...filters, characterGroups: [['c']] }
    const undone = { ...changed, characterGroups: [] }

    expect(hasListEditChanges(changed, listEdit)).toBe(true)
    expect(hasListEditChanges(undone, listEdit)).toBe(false)
  })
})
