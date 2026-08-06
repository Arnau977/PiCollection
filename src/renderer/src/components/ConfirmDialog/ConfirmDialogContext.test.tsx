// @vitest-environment jsdom
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialogProvider, useConfirm, type ConfirmOptions } from './ConfirmDialogContext'

function Harness({ options }: { options: ConfirmOptions | string }): JSX.Element {
  const confirm = useConfirm()
  const [result, setResult] = useState('pending')

  async function trigger(): Promise<void> {
    setResult(String(await confirm(options)))
  }

  return (
    <div>
      <button onClick={trigger}>trigger</button>
      <span data-testid="result">{result}</span>
    </div>
  )
}

function renderHarness(options: ConfirmOptions | string): void {
  render(
    <ConfirmDialogProvider>
      <Harness options={options} />
    </ConfirmDialogProvider>
  )
}

describe('ConfirmDialogProvider / useConfirm', () => {
  it('renders no dialog until confirm() is called', () => {
    renderHarness('Delete this?')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows the message and resolves true when Confirm is clicked', async () => {
    const user = userEvent.setup()
    renderHarness('Delete this?')

    await user.click(screen.getByRole('button', { name: 'trigger' }))
    expect(screen.getByText('Delete this?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('true'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('resolves false when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderHarness('Delete this?')

    await user.click(screen.getByRole('button', { name: 'trigger' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'))
  })

  it('resolves false on Escape', async () => {
    const user = userEvent.setup()
    renderHarness('Delete this?')

    await user.click(screen.getByRole('button', { name: 'trigger' }))
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'))
  })

  it('resolves false on backdrop click', async () => {
    const user = userEvent.setup()
    renderHarness('Delete this?')

    await user.click(screen.getByRole('button', { name: 'trigger' }))
    await user.click(screen.getByRole('alertdialog').parentElement as HTMLElement)

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'))
  })

  it('focuses the Cancel button initially', async () => {
    const user = userEvent.setup()
    renderHarness('Delete this?')

    await user.click(screen.getByRole('button', { name: 'trigger' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('applies the danger style to the confirm button when danger is true', async () => {
    const user = userEvent.setup()
    renderHarness({ message: 'Delete this?', danger: true })

    await user.click(screen.getByRole('button', { name: 'trigger' }))

    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('btn-danger')
  })

  it('uses custom title and button labels when provided', async () => {
    const user = userEvent.setup()
    renderHarness({
      message: 'This deletes 3 items.',
      title: 'Are you sure?',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep'
    })

    await user.click(screen.getByRole('button', { name: 'trigger' }))

    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument()
  })
})
