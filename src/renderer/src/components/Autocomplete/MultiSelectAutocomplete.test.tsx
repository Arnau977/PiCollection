// @vitest-environment jsdom
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiSelectAutocomplete } from './MultiSelectAutocomplete'

interface Option {
  id: string
  name: string
}

const OPTIONS: Option[] = [
  { id: '1', name: 'Landscape' },
  { id: '2', name: 'Portrait' },
  { id: '3', name: 'Abstract' }
]

function Wrapper({ initial = [] as string[] }: { initial?: string[] }): JSX.Element {
  const [selected, setSelected] = useState<string[]>(initial)
  return (
    <MultiSelectAutocomplete
      name="tags"
      label="Tags"
      options={OPTIONS}
      getOptionLabel={(o) => o.name}
      getOptionValue={(o) => o.id}
      selectedValues={selected}
      onChange={setSelected}
    />
  )
}

function openDropdown(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole('button', { name: /show suggestions/i }))
}

describe('MultiSelectAutocomplete', () => {
  it('renders no chips when nothing is selected', () => {
    render(<Wrapper />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('adds a chip and calls onChange when an option is picked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MultiSelectAutocomplete
        name="tags"
        label="Tags"
        options={OPTIONS}
        getOptionLabel={(o) => o.name}
        getOptionValue={(o) => o.id}
        selectedValues={[]}
        onChange={onChange}
      />
    )

    await openDropdown(user)
    await user.click(await screen.findByRole('option', { name: 'Portrait' }))

    expect(onChange).toHaveBeenCalledWith(['2'])
  })

  it('excludes already-selected options from the dropdown', async () => {
    const user = userEvent.setup()
    render(<Wrapper initial={['1']} />)

    expect(screen.getByText('Landscape')).toBeInTheDocument() // shown as a chip

    await openDropdown(user)
    expect(screen.queryByRole('option', { name: 'Landscape' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Portrait' })).toBeInTheDocument()
  })

  it('removes a chip when its remove button is clicked', async () => {
    const user = userEvent.setup()
    render(<Wrapper initial={['1', '2']} />)

    expect(screen.getByText('Landscape')).toBeInTheDocument()
    expect(screen.getByText('Portrait')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /quitar landscape/i }))

    expect(screen.queryByText('Landscape')).not.toBeInTheDocument()
    expect(screen.getByText('Portrait')).toBeInTheDocument()
  })
})
