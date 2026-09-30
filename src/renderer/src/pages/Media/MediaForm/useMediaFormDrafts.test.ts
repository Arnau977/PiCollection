// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import type { CharacterModel, MediaInput, TagModel } from '@shared/models'
import { useMediaFormDrafts } from './useMediaFormDrafts'

const list = <T>(data: T[]): { data: T[]; refetch: () => void } => ({ data, refetch: vi.fn() })

describe('useMediaFormDrafts character forms', () => {
  it('creates a new base character before its form, linked as its parent, once', async () => {
    const created: { name: string; parentId?: string }[] = []
    const create = vi.fn(async (input: { name: string; parentId?: string }) => {
      created.push(input)
      return { success: true, data: { id: `id-${input.name}`, name: input.name, series: [] } }
    })
    Object.defineProperty(window, 'api', {
      value: {
        character: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }), create }
      },
      configurable: true
    })

    const { result } = renderHook(() => {
      const [input, setInput] = useState<MediaInput>({
        route: 'a.png',
        type: 'image'
      } as MediaInput)
      const drafts = useMediaFormDrafts({
        input,
        setInput,
        artists: list([]),
        tags: list([]),
        characters: list<CharacterModel>([]),
        series: list([])
      })
      return { input, drafts }
    })

    act(() => {
      result.current.drafts.createCharacter('Pyra (Pro Swimmer)', 'Pyra')
      result.current.drafts.createCharacter('Pyra (Massive Melee)', 'Pyra')
    })
    let resolved: string[] = []
    await act(async () => {
      resolved = (await result.current.drafts.resolveForSave()).resolvedCharacterIds
    })

    expect(created).toEqual([
      { name: 'Pyra', seriesIds: [], parentId: undefined },
      { name: 'Pyra (Pro Swimmer)', seriesIds: [], parentId: 'id-Pyra' },
      { name: 'Pyra (Massive Melee)', seriesIds: [], parentId: 'id-Pyra' }
    ])
    // The media gets the forms only; "Pyra" searches still find them via the hierarchy.
    expect(resolved).toEqual(['id-Pyra (Pro Swimmer)', 'id-Pyra (Massive Melee)'])
  })

  it('replaces an already-selected base character with the accepted form', () => {
    const pyra: CharacterModel = { id: 'c-pyra', name: 'Pyra', series: [] }
    const { result } = renderHook(() => {
      const [input, setInput] = useState<MediaInput>({
        route: 'a.png',
        type: 'image',
        characterIds: ['c-pyra']
      } as MediaInput)
      const drafts = useMediaFormDrafts({
        input,
        setInput,
        artists: list([]),
        tags: list([]),
        characters: list([pyra]),
        series: list([])
      })
      return { input, drafts }
    })

    act(() => result.current.drafts.createCharacter('Pyra (Pro Swimmer)', 'Pyra'))

    const [draft] = result.current.drafts.pendingCharacters
    expect(result.current.input.characterIds).toEqual([draft.id])
  })
})

describe('useMediaFormDrafts after a save', () => {
  function renderDrafts(initialTagIds: string[], existingTags: TagModel[]) {
    return renderHook(() => {
      const [input, setInput] = useState<MediaInput>({
        route: 'a.png',
        type: 'image',
        tagIds: initialTagIds
      } as MediaInput)
      const drafts = useMediaFormDrafts({
        input,
        setInput,
        artists: list([]),
        tags: list(existingTags),
        characters: list([]),
        series: list([])
      })
      return { input, drafts }
    })
  }

  function mockTagApi(existing: TagModel[]): void {
    Object.defineProperty(window, 'api', {
      value: {
        tag: {
          getAll: vi.fn().mockResolvedValue({ success: true, data: existing }),
          create: vi.fn(async ({ name }: { name: string }) => ({
            success: true,
            data: { id: `id-${name}`, name }
          }))
        }
      },
      configurable: true
    })
  }

  it('swaps a saved draft for the real tag it became', async () => {
    mockTagApi([])
    const { result } = renderDrafts([], [])

    act(() => result.current.drafts.createTag('Body Writing'))
    await act(async () => {
      const { idMap } = await result.current.drafts.resolveForSave()
      result.current.drafts.commitSaved(idMap)
    })

    expect(result.current.input.tagIds).toEqual(['id-Body Writing'])
  })

  // A draft whose name now exists (created by an earlier save) resolves to
  // that tag - if the tag was also picked directly, it must be sent once.
  it('sends a tag once when a draft resolves to an already-selected tag', async () => {
    const bodyWriting: TagModel = { id: 't-body', name: 'Body Writing' }
    mockTagApi([bodyWriting])
    const { result } = renderDrafts(['t-body'], [bodyWriting])

    act(() => result.current.drafts.createTag('Body Writing'))
    let tagIds: string[] | undefined
    await act(async () => {
      tagIds = (await result.current.drafts.resolveForSave()).resolvedInput.tagIds
    })

    expect(tagIds).toEqual(['t-body'])
  })
})
