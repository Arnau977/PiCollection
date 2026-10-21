import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { openHeldCharacters, type HeldCharacter } from '../../../hooks/tagSuggestionMatching'

interface HeldCharacterChoicesProps {
  held: HeldCharacter[]
  selectedCharacterIds: string[]
  onPick: (entry: HeldCharacter, characterId: string) => void
}

/**
 * "Recognized as Yae Sakura - or one inspired by her?": the model names the
 * original for her expys too, so neither she nor her series was applied.
 * One chip per choice; picking one adds it (the original with her series).
 */
export function HeldCharacterChoices({
  held,
  selectedCharacterIds,
  onPick
}: HeldCharacterChoicesProps): JSX.Element | null {
  const { t } = useTranslation()
  const open = openHeldCharacters(held, selectedCharacterIds)
  if (open.length === 0) return null

  return (
    <>
      {open.map((entry) => (
        <div className="sauce-missing-row" key={entry.original.id}>
          <span className="sauce-cat-label">
            {t('suggestions.heldLabel', { name: entry.original.name })}
          </span>
          <ul className="chip-list chip-list-characters">
            {[entry.original, ...entry.expys].map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  className="sauce-add-chip"
                  onClick={() => onPick(entry, choice.id)}
                >
                  <Plus size={12} />
                  {choice.name}
                  {choice.id !== entry.original.id && (
                    <span className="sauce-hint">
                      {t('suggestions.inspiredByHint', { name: entry.original.name })}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}
