// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { SHORTCUTS, useShortcut, type Shortcut } from './useShortcut'

function Harness({ shortcut, onFire }: { shortcut: Shortcut; onFire: () => void }): JSX.Element {
  useShortcut(shortcut, onFire)
  return <input aria-label="field" />
}

describe('useShortcut', () => {
  it('skips a plain-key shortcut while typing, but not a Ctrl one', () => {
    const onEdit = vi.fn()
    const onSave = vi.fn()
    const { getAllByLabelText } = render(
      <>
        <Harness shortcut={SHORTCUTS.edit} onFire={onEdit} />
        <Harness shortcut={SHORTCUTS.save} onFire={onSave} />
      </>
    )
    const [field] = getAllByLabelText('field')

    fireEvent.keyDown(field, { key: 'e' })
    fireEvent.keyDown(field, { key: 's', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'e' })

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('leaves the keyboard to an open modal dialog', () => {
    const onSave = vi.fn()
    render(
      <>
        <Harness shortcut={SHORTCUTS.save} onFire={onSave} />
        <div role="dialog" aria-modal="true" />
      </>
    )

    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true })

    expect(onSave).not.toHaveBeenCalled()
  })
})
