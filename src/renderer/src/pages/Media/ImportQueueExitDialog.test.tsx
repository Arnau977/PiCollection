// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImportQueueExitDialog } from './ImportQueueExitDialog'

describe('ImportQueueExitDialog', () => {
  it('shows the remaining count and all three actions', () => {
    render(
      <ImportQueueExitDialog
        remaining={3}
        onAddToPending={vi.fn()}
        onDiscard={vi.fn()}
        onKeepEditing={vi.fn()}
      />
    )

    expect(
      screen.getByText("3 file(s) haven't been added yet. What would you like to do with them?")
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add remaining to Pending' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
  })

  it('calls onAddToPending when that button is clicked', () => {
    const onAddToPending = vi.fn()
    render(
      <ImportQueueExitDialog
        remaining={1}
        onAddToPending={onAddToPending}
        onDiscard={vi.fn()}
        onKeepEditing={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add remaining to Pending' }))
    expect(onAddToPending).toHaveBeenCalledTimes(1)
  })

  it('calls onDiscard when that button is clicked', () => {
    const onDiscard = vi.fn()
    render(
      <ImportQueueExitDialog remaining={1} onAddToPending={vi.fn()} onDiscard={onDiscard} onKeepEditing={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('calls onKeepEditing when that button is clicked or the backdrop is clicked', () => {
    const onKeepEditing = vi.fn()
    const { container } = render(
      <ImportQueueExitDialog remaining={1} onAddToPending={vi.fn()} onDiscard={vi.fn()} onKeepEditing={onKeepEditing} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(onKeepEditing).toHaveBeenCalledTimes(1)

    fireEvent.click(container.querySelector('.confirm-dialog-backdrop') as HTMLElement)
    expect(onKeepEditing).toHaveBeenCalledTimes(2)
  })
})
