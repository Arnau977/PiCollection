// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Autocomplete } from './Autocomplete'

interface Option {
  id: string
  name: string
}

const OPTIONS: Option[] = [
  { id: '1', name: 'Landscape' },
  { id: '2', name: 'Portrait' }
]

function renderAutocomplete(
  overrides: Partial<React.ComponentProps<typeof Autocomplete<Option>>> = {}
) {
  const onSelect = vi.fn()
  render(
    <Autocomplete
      name="test"
      label="Test field"
      options={OPTIONS}
      getOptionLabel={(o) => o.name}
      getOptionValue={(o) => o.id}
      onSelect={onSelect}
      {...overrides}
    />
  )
  return { onSelect }
}

function openDropdown(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole('button', { name: /show suggestions/i }))
}

describe('Autocomplete', () => {
  it('shows all options when opened without typing', async () => {
    const user = userEvent.setup()
    renderAutocomplete()

    await openDropdown(user)

    expect(await screen.findByRole('option', { name: 'Landscape' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Portrait' })).toBeInTheDocument()
  })

  it('filters options as the user types', async () => {
    const user = userEvent.setup()
    renderAutocomplete()

    const input = screen.getByRole('combobox')
    await openDropdown(user)
    await user.type(input, 'land')

    expect(await screen.findByRole('option', { name: 'Landscape' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Portrait' })).not.toBeInTheDocument()
  })

  it('calls onSelect with the matching option when one is picked, and shows its label in the input', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderAutocomplete()

    const input = screen.getByRole('combobox')
    await openDropdown(user)
    const option = await screen.findByRole('option', { name: 'Portrait' })
    await user.click(option)

    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1])
    expect(input).toHaveValue('Portrait')
  })

  it('clears the input back to empty after a pick when resetQueryAfterSelect is set', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderAutocomplete({ resetQueryAfterSelect: true })

    const input = screen.getByRole('combobox')
    await openDropdown(user)
    const option = await screen.findByRole('option', { name: 'Portrait' })
    await user.click(option)

    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1])
    expect(input).toHaveValue('')
  })
})
