import { describe, expect, it } from 'vitest'
import type { FilterListModel, MediaFilters } from '@shared/models'
import { appliedAfterSaving, beginListEdit, filtersAfterListEdit, listEditDraft } from './listEdit'
import { toDraft } from './filterListDraft'

const list = (filters: FilterListModel['filters'], includedListIds: string[] = []) =>
  ({
    id: 'apta',
    name: 'Apta',
    filters,
    includedListIds,
    hasMissingEntities: false,
    createdAt: 1,
    updatedAt: 1
  }) satisfies FilterListModel

describe('beginListEdit', () => {
  it('opens the list into loose filters, with its includes as applied lists', () => {
    const { filters } = beginListEdit(
      list({ tagGroups: [['-feet']] }, ['base']),
      { filterListIds: ['apta'] },
      {}
    )

    expect(filters).toMatchObject({ tagGroups: [['-feet']], filterListIds: ['base'] })
  })

  it('takes in what was added beside the list, since that is why it is being edited', () => {
    const { filters } = beginListEdit(
      list({ tagGroups: [['-feet']] }),
      { filterListIds: ['apta'], tagGroups: [['-gore']] },
      {}
    )

    expect(filters.tagGroups).toEqual([['-gore', '-feet']])
  })

  it('sets other applied lists aside: they are not part of this one', () => {
    const { filters, listEdit } = beginListEdit(
      list({ sfw: true }),
      { filterListIds: ['apta', 'other'] },
      {}
    )

    expect(filters.filterListIds).toBeUndefined()
    expect(listEdit.before.filterListIds).toEqual(['apta', 'other'])
  })

  it('keeps a gallery default applied without making it part of the list', () => {
    const { filters, listEdit } = beginListEdit(
      list({ tagGroups: [['a']] }),
      { sfw: true, filterListIds: ['apta'] },
      { sfw: true }
    )

    expect(filters.sfw).toBe(true)
    expect(listEditDraft(filters, listEdit).filters.sfw).toBeUndefined()
  })

  it('saves a filter the user chose even when a default exists for another value', () => {
    const { filters, listEdit } = beginListEdit(
      list({}),
      { sfw: false, filterListIds: ['apta'] },
      { sfw: true }
    )

    expect(listEditDraft(filters, listEdit).filters.sfw).toBe(false)
  })

  it("lets the list's own value win over a default it contradicts", () => {
    const { filters, listEdit } = beginListEdit(
      list({ sfw: false }),
      { sfw: true, filterListIds: ['apta'] },
      { sfw: true }
    )

    expect(filters.sfw).toBe(false)
    expect(listEdit.heldDefaults).toEqual({})
  })

  it('opens the list alone when what was beside it can never match it', () => {
    const { filters } = beginListEdit(
      list({ type: 'video' }),
      { type: 'image', filterListIds: ['apta'] },
      {}
    )

    expect(filters.type).toBe('video')
  })
})

describe('filtersAfterListEdit', () => {
  it('goes back to the chip, keeping the default and the lists set aside', () => {
    const { listEdit } = beginListEdit(
      list({ tagGroups: [['a']] }),
      { sfw: true, tagGroups: [['b']], filterListIds: ['apta', 'other'] },
      { sfw: true }
    )

    expect(filtersAfterListEdit(listEdit)).toEqual({
      sfw: true,
      filterListIds: ['apta', 'other']
    })
  })
})

describe('appliedAfterSaving', () => {
  const saved = (filters: MediaFilters): ReturnType<typeof toDraft> => toDraft(filters)

  it('replaces everything saved with the new list', () => {
    const filters: MediaFilters = { sfw: true, tagGroups: [['a']], filterListIds: ['base'] }

    expect(appliedAfterSaving(filters, saved(filters), 'new')).toEqual({ filterListIds: ['new'] })
  })

  it('keeps what was taken out of the list applied, so the results stay the same', () => {
    const filters: MediaFilters = {
      sfw: true,
      tagGroups: [['a', 'b']],
      characterGroups: [['-c']],
      exactCharacterIds: ['c'],
      filterListIds: ['base', 'other']
    }
    const draft = saved({ tagGroups: [['a']], filterListIds: ['base'] })

    expect(appliedAfterSaving(filters, draft, 'new')).toEqual({
      sfw: true,
      tagGroups: [['b']],
      characterGroups: [['-c']],
      exactCharacterIds: ['c'],
      filterListIds: ['other', 'new']
    })
  })

  it('leaves the gallery alone when a removed entry was one side of an OR', () => {
    const filters: MediaFilters = { tagGroups: [['a'], ['b']] }

    expect(appliedAfterSaving(filters, saved({ tagGroups: [['a']] }), 'new')).toBeNull()
  })
})
