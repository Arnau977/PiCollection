import { useState, type Dispatch, type SetStateAction } from 'react'
import type { CharacterModel, MediaInput, SeriesModel } from '@shared/models'
import { detectCharacterParent } from './detectCharacterParent'

export interface CharacterParentLinks {
  /** The parent a character will have after saving: a pending link, else its own. */
  parentOf: (characterId: string) => string | null
  /** Links (or with null, unlinks) a character - a draft or an existing one - on save. */
  setParent: (characterId: string, parentId: string | null) => void
  /** For a name just typed: links it to the base character its name points at, if any. */
  autoLink: (characterId: string, name: string) => void
  /** Ids a character can't take as parent: itself and everything under it. */
  excludedParents: (characterId: string) => Set<string>
  /** Writes the pending links once drafts have their real ids. Throws on failure. */
  apply: (idMap: Map<string, string>) => Promise<void>
}

interface UseCharacterParentLinksArgs {
  setInput: Dispatch<SetStateAction<MediaInput>>
  characters: CharacterModel[]
  pendingCharacters: CharacterModel[]
  series: SeriesModel[]
}

/**
 * "Form of" links set from the edit form, for a character created there or
 * one already in the library, so a tagging session doesn't have to stop at
 * Metadata. Like every other change in the form they only reach the library
 * on save; cancelling drops them.
 */
export function useCharacterParentLinks({
  setInput,
  characters,
  pendingCharacters,
  series
}: UseCharacterParentLinksArgs): CharacterParentLinks {
  const [links, setLinks] = useState<Map<string, string | null>>(new Map())

  function parentOf(characterId: string): string | null {
    if (links.has(characterId)) return links.get(characterId) ?? null
    return characters.find((character) => character.id === characterId)?.parentId ?? null
  }

  function setParent(characterId: string, parentId: string | null): void {
    setLinks((prev) => new Map(prev).set(characterId, parentId))
    // The form replaces its base on this media, as with a suggested form:
    // searches for the base still find it through the hierarchy. A new base
    // stays: it's only created on save if it's still in the field.
    if (parentId && characters.some((character) => character.id === parentId)) {
      setInput((prev) => ({
        ...prev,
        characterIds: (prev.characterIds ?? []).filter((id) => id !== parentId)
      }))
    }
  }

  function autoLink(characterId: string, name: string): void {
    const parent = detectCharacterParent(name, [...characters, ...pendingCharacters], series)
    if (parent) setParent(characterId, parent.id)
  }

  function excludedParents(characterId: string): Set<string> {
    const all = [...characters, ...pendingCharacters]
    const excluded = new Set([characterId])
    let grew = true
    while (grew) {
      grew = false
      for (const character of all) {
        const parent = parentOf(character.id)
        if (parent && excluded.has(parent) && !excluded.has(character.id)) {
          excluded.add(character.id)
          grew = true
        }
      }
    }
    return excluded
  }

  async function apply(idMap: Map<string, string>): Promise<void> {
    if (links.size === 0) return
    // Fresh: characters this same save just created aren't in the list yet.
    const fresh = await window.api.character.getAll()
    if (!fresh.success) throw new Error(fresh.error.message)
    // One at a time: a chain of new forms must link in order.
    for (const [childId, parentId] of links) {
      const realChild = idMap.get(childId) ?? childId
      const realParent = parentId ? (idMap.get(parentId) ?? parentId) : null
      const character = fresh.data.find((candidate) => candidate.id === realChild)
      // A new character (or new base) removed from the field before saving
      // was never created: nothing to link.
      const parentExists = realParent === null || fresh.data.some((c) => c.id === realParent)
      if (!character || !parentExists || (character.parentId ?? null) === realParent) continue
      const result = await window.api.character.update(character.id, {
        name: character.name,
        seriesIds: character.series.map((linked) => linked.id),
        aliases: character.aliases,
        parentId: realParent
      })
      if (!result.success) throw new Error(result.error.message)
    }
    setLinks(new Map())
  }

  return { parentOf, setParent, autoLink, excludedParents, apply }
}
