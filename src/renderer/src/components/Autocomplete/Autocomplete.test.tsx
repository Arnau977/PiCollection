// @vitest-environment jsdom
import { useState } from 'react'
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

/** Mirrors real usage (FilterBar, MediaForm, SeriesManager): `selectedKey` is fed
 * back from the parent's own state rather than left uncontrolled. */
function ControlledAutocomplete(): JSX.Element {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  return (
    <Autocomplete
      name="test"
      label="Test field"
      options={OPTIONS}
      getOptionLabel={(o) => o.name}
      getOptionValue={(o) => o.id}
      selectedKey={selectedKey}
      onSelect={(option) => setSelectedKey(option?.id ?? null)}
    />
  )
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

  it('disables the input when disabled is true', () => {
    renderAutocomplete({ disabled: true })
    expect(screen.getByRole('combobox')).toBeDisabled()
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

  it('clears a selection when the text is deleted and the field loses focus', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <ControlledAutocomplete />
        <button>outside</button>
      </div>
    )

    const input = screen.getByRole('combobox')
    await openDropdown(user)
    await user.click(await screen.findByRole('option', { name: 'Portrait' }))
    expect(input).toHaveValue('Portrait')

    await user.clear(input)
    await user.click(screen.getByText('outside'))

    expect(input).toHaveValue('')
  })

  it('clears a selection when the text is deleted and Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<ControlledAutocomplete />)

    const input = screen.getByRole('combobox')
    await openDropdown(user)
    await user.click(await screen.findByRole('option', { name: 'Portrait' }))
    expect(input).toHaveValue('Portrait')

    await user.clear(input)
    await user.keyboard('{Enter}')

    expect(input).toHaveValue('')
  })

  it('shows the selected option label when selectedKey changes from outside the dropdown', () => {
    const { rerender } = render(
      <Autocomplete
        name="test"
        label="Test field"
        options={OPTIONS}
        getOptionLabel={(o) => o.name}
        getOptionValue={(o) => o.id}
        onSelect={vi.fn()}
        selectedKey={null}
      />
    )

    expect(screen.getByRole('combobox')).toHaveValue('')

    // Simulates a parent setting the id directly (e.g. after creating a new
    // option asynchronously elsewhere) rather than the user picking it here.
    rerender(
      <Autocomplete
        name="test"
        label="Test field"
        options={OPTIONS}
        getOptionLabel={(o) => o.name}
        getOptionValue={(o) => o.id}
        onSelect={vi.fn()}
        selectedKey="2"
      />
    )

    expect(screen.getByRole('combobox')).toHaveValue('Portrait')
  })

  it('picks up the label once the matching option arrives after selectedKey is already set', () => {
    const { rerender } = render(
      <Autocomplete
        name="test"
        label="Test field"
        options={[]}
        getOptionLabel={(o: (typeof OPTIONS)[number]) => o.name}
        getOptionValue={(o: (typeof OPTIONS)[number]) => o.id}
        onSelect={vi.fn()}
        selectedKey="2"
      />
    )

    expect(screen.getByRole('combobox')).toHaveValue('')

    // The option only shows up once a refetch resolves, after selectedKey
    // was already set - the display must still catch up.
    rerender(
      <Autocomplete
        name="test"
        label="Test field"
        options={OPTIONS}
        getOptionLabel={(o) => o.name}
        getOptionValue={(o) => o.id}
        onSelect={vi.fn()}
        selectedKey="2"
      />
    )

    expect(screen.getByRole('combobox')).toHaveValue('Portrait')
  })

  describe('create-suppression matching', () => {
    interface LabeledOption {
      id: string
      name: string
      series: string
    }

    const TAGGED_OPTIONS: LabeledOption[] = [{ id: '1', name: 'Ishtar', series: 'Fate' }]

    it('falls back to getOptionLabel for the "Create" suppression check when getOptionMatchName is not provided', async () => {
      const user = userEvent.setup()
      render(
        <Autocomplete
          name="test"
          label="Test field"
          options={TAGGED_OPTIONS}
          getOptionLabel={(o) => `${o.name} (${o.series})`}
          getOptionValue={(o) => o.id}
          onSelect={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      const input = screen.getByRole('combobox')
      await user.type(input, 'Ishtar')

      // The typed text doesn't exactly match the rendered label ("Ishtar (Fate)"),
      // so without an explicit getOptionMatchName the create option is still offered.
      expect(await screen.findByText('Create "Ishtar"')).toBeInTheDocument()
    })

    it('uses getOptionMatchName instead of getOptionLabel to suppress the "Create" option', async () => {
      const user = userEvent.setup()
      render(
        <Autocomplete
          name="test"
          label="Test field"
          options={TAGGED_OPTIONS}
          getOptionLabel={(o) => `${o.name} (${o.series})`}
          getOptionMatchName={(o) => o.name}
          getOptionValue={(o) => o.id}
          onSelect={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      const input = screen.getByRole('combobox')
      await user.type(input, 'Ishtar')

      expect(await screen.findByRole('option', { name: 'Ishtar (Fate)' })).toBeInTheDocument()
      expect(screen.queryByText('Create "Ishtar"')).not.toBeInTheDocument()
    })
  })
})
