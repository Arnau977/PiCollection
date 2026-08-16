// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MediaFilters } from '@shared/models'
import { MoreFiltersPopover } from './MoreFiltersPopover'

function renderPopover(filters: MediaFilters = {}) {
  const onFiltersChange = vi.fn()
  render(<MoreFiltersPopover filters={filters} onFiltersChange={onFiltersChange} />)
  return { onFiltersChange }
}

describe('MoreFiltersPopover', () => {
  it('opens the panel on click and closes it again on a second click', async () => {
    const user = userEvent.setup()
    renderPopover()

    const trigger = screen.getByRole('button', { name: /more filters/i })
    expect(screen.queryByLabelText('AI')).not.toBeInTheDocument()

    await user.click(trigger)
    expect(screen.getByLabelText('AI')).toBeInTheDocument()

    await user.click(trigger)
    expect(screen.queryByLabelText('AI')).not.toBeInTheDocument()
  })

  it('closes the panel on an outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button type="button">outside</button>
        <MoreFiltersPopover filters={{}} onFiltersChange={vi.fn()} />
      </div>
    )

    await user.click(screen.getByRole('button', { name: /more filters/i }))
    expect(screen.getByLabelText('AI')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByLabelText('AI')).not.toBeInTheDocument()
  })

  it('sets sfw: true when "SFW only" is selected', async () => {
    const user = userEvent.setup()
    const { onFiltersChange } = renderPopover({ isAiGenerated: true })

    await user.click(screen.getByRole('button', { name: /more filters/i }))
    fireEvent.change(screen.getByLabelText('SFW'), { target: { value: 'sfw' } })

    expect(onFiltersChange).toHaveBeenCalledWith({ isAiGenerated: true, sfw: true })
  })

  it('shows no badge when neither filter is active', () => {
    renderPopover()

    expect(screen.getByRole('button', { name: /more filters/i })).toHaveTextContent('More filters')
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })
})
