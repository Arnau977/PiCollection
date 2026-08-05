// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManageSortControl } from './ManageSortControl'
import type { ManageSort } from '../../utils/manageSort'

describe('ManageSortControl', () => {
  it('shows the current sort prop and direction', () => {
    const sort: ManageSort = { prop: 'createdAt', desc: true }
    render(<ManageSortControl sort={sort} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Sort by')).toHaveValue('createdAt')
    expect(screen.getByRole('button', { name: 'Descending' })).toBeInTheDocument()
  })

  it('calls onChange with the new prop when the select changes, preserving direction', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ManageSortControl sort={{ prop: 'name', desc: false }} onChange={onChange} />)

    await user.selectOptions(screen.getByLabelText('Sort by'), 'createdAt')

    expect(onChange).toHaveBeenCalledWith({ prop: 'createdAt', desc: false })
  })

  it('calls onChange with the direction flipped when the direction button is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ManageSortControl sort={{ prop: 'name', desc: false }} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Ascending' }))

    expect(onChange).toHaveBeenCalledWith({ prop: 'name', desc: true })
  })
})
