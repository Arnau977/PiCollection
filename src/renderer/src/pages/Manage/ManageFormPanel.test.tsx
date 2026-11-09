// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ManageFormPanel } from './ManageFormPanel'

function mockNarrow(matches: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }) as unknown as MediaQueryList
  )
}

const panel = (editing: boolean): JSX.Element => (
  <ManageFormPanel title="Add new" editing={editing}>
    <input aria-label="Name" />
  </ManageFormPanel>
)

describe('ManageFormPanel', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows the form with a plain heading in a wide window', () => {
    mockNarrow(false)
    render(panel(false))
    expect(screen.getByRole('heading', { name: 'Add new' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeVisible()
  })

  it('starts folded in a narrow window, opens on its heading and on edit', () => {
    mockNarrow(true)
    const { rerender } = render(panel(false))
    const toggle = screen.getByRole('button', { name: 'Add new' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('Name')).not.toBeVisible()

    fireEvent.click(toggle)
    expect(screen.getByLabelText('Name')).toBeVisible()
    fireEvent.click(toggle)
    expect(screen.getByLabelText('Name')).not.toBeVisible()

    rerender(panel(true))
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
