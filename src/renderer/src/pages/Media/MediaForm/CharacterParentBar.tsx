import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CornerDownRight, X } from 'lucide-react'
import type { CharacterModel } from '@shared/models'
import { Autocomplete } from '../../../components/Autocomplete/Autocomplete'

interface CharacterParentBarProps {
  childName: string
  parentId: string | null
  /** Characters it can be a form of: itself and its own forms left out. */
  options: CharacterModel[]
  getOptionLabel: (character: CharacterModel) => string
  onPick: (parentId: string | null) => void
  onClose: () => void
}

/**
 * Inline bar under the Characters field (where the tag finder's sits) that
 * sets which character a chip is a form of. Opened from the chip's own
 * button; Esc or × closes it, focus goes straight to the picker.
 */
export function CharacterParentBar({
  childName,
  parentId,
  options,
  getOptionLabel,
  onPick,
  onClose
}: CharacterParentBarProps): JSX.Element {
  const { t } = useTranslation()
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    barRef.current?.querySelector('input')?.focus()
  }, [childName])

  return (
    <div
      ref={barRef}
      className="character-parent-bar"
      role="group"
      aria-label={t('characterParent.barLabel', { name: childName })}
      onKeyDown={(e) => {
        // The picker's own Esc closes its list first; a second one lands here.
        if (e.key === 'Escape' && !e.defaultPrevented) onClose()
      }}
    >
      <CornerDownRight size={14} className="character-parent-bar-icon" aria-hidden="true" />
      <span className="character-parent-bar-label">
        {t('characterParent.barLabel', { name: childName })}
      </span>
      <div className="character-parent-bar-picker">
        <Autocomplete
          name="character-parent"
          label={t('characterParent.picker')}
          hideLabel
          options={options}
          getOptionLabel={getOptionLabel}
          getOptionMatchName={(character) => character.name}
          getOptionValue={(character) => character.id}
          selectedKey={parentId}
          onSelect={(character) => {
            if (character) onPick(character.id)
          }}
        />
      </div>
      {parentId && (
        <button type="button" className="btn" onClick={() => onPick(null)}>
          {t('characterParent.remove')}
        </button>
      )}
      <button
        type="button"
        className="icon-btn"
        aria-label={t('characterParent.close')}
        title={t('characterParent.close')}
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </div>
  )
}
