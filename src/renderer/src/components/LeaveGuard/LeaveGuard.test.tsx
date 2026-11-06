// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { TestRouter } from '../../test-router'
import { LeaveGuard } from './LeaveGuard'

type OnAttempt = (decide: (leave: boolean) => void) => void

function Form({ onAttempt }: { onAttempt: OnAttempt }): JSX.Element {
  const navigate = useNavigate()
  return (
    <>
      <LeaveGuard onAttempt={onAttempt} />
      <h1>Form</h1>
      <Link to="/other">Sidebar link</Link>
      <button onClick={() => navigate('/other', { replace: true })}>Saved</button>
    </>
  )
}

function renderForm(onAttempt: OnAttempt): void {
  render(
    <TestRouter initialEntries={['/form']}>
      <Routes>
        <Route path="/form" element={<Form onAttempt={onAttempt} />} />
        <Route path="/other" element={<h1>Other</h1>} />
      </Routes>
    </TestRouter>
  )
}

describe('LeaveGuard', () => {
  it('stays when the user chooses to', async () => {
    const user = userEvent.setup()
    renderForm((decide) => decide(false))

    await user.click(screen.getByRole('link', { name: 'Sidebar link' }))

    expect(await screen.findByRole('heading', { name: 'Form' })).toBeInTheDocument()
  })

  it('goes where the user was heading once they choose to leave', async () => {
    const user = userEvent.setup()
    renderForm((decide) => decide(true))

    await user.click(screen.getByRole('link', { name: 'Sidebar link' }))

    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument()
  })

  it('lets the app move on after a finished action', async () => {
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    renderForm(onAttempt)

    await user.click(screen.getByRole('button', { name: 'Saved' }))

    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument()
    expect(onAttempt).not.toHaveBeenCalled()
  })
})
