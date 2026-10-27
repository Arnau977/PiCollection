// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import type { CharacterModel, MediaInput } from '@shared/models'
import { useCharacterParentLinks } from './useCharacterParentLinks'

const goldShip: CharacterModel = { id: 'gold', name: 'Gold ship (Umamusume)', series: [] }
const summer: CharacterModel = {
  id: 'summer',
  name: 'Gold ship (Summer) (Umamusume)',
  series: [],
  parentId: 'gold'
}
const draft: CharacterModel = {
  id: 'draft',
  name: 'gold ship (run! ruin! launcher!) (Umamusume)',
  series: []
}

function setup(): ReturnType<
  typeof renderHook<
    { input: MediaInput; links: ReturnType<typeof useCharacterParentLinks> },
    unknown
  >
> {
  return renderHook(() => {
    const [input, setInput] = useState<MediaInput>({
      name: 'x',
      type: 'image',
      route: 'x.png',
      sfw: true,
      isAiGenerated: false,
      characterIds: ['gold', 'draft']
    })
    const links = useCharacterParentLinks({
      setInput,
      characters: [goldShip, summer],
      pendingCharacters: [draft],
      series: [{ id: 's', name: 'Umamusume' }]
    })
    return { input, links }
  })
}

describe('useCharacterParentLinks', () => {
  it('links a typed form to its base, which leaves the media, and writes it on save', async () => {
    const update = vi.fn().mockResolvedValue({ success: true, data: {} })
    Object.defineProperty(window, 'api', {
      value: {
        character: {
          getAll: vi.fn().mockResolvedValue({
            success: true,
            data: [goldShip, summer, { ...draft, id: 'created' }]
          }),
          update
        }
      },
      configurable: true
    })
    const { result } = setup()

    act(() => result.current.links.autoLink('draft', draft.name))
    expect(result.current.links.parentOf('draft')).toBe('gold')
    expect(result.current.input.characterIds).toEqual(['draft'])

    await act(() => result.current.links.apply(new Map([['draft', 'created']])))
    expect(update).toHaveBeenCalledWith('created', {
      name: draft.name,
      seriesIds: [],
      aliases: undefined,
      parentId: 'gold'
    })
  })

  it('never offers a character, or one of its own forms, as its parent', () => {
    const { result } = setup()
    expect([...result.current.links.excludedParents('gold')].sort()).toEqual(['gold', 'summer'])
  })
})
