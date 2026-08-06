// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GroupedEntityFilter } from './GroupedEntityFilter'

interface Option {
  id: string
  name: string
}

const options: Option[] = [
  { id: 'ishtar', name: 'Ishtar' },
  { id: 'ereshkigal', name: 'Ereshkigal' },
  { id: 'rin', name: 'Rin' },
  { id: 'shirou', name: 'Shirou' }
]

function renderFilter(
  groups: string[][] = [],
  noneOption?: { checked: boolean; onChange: (checked: boolean) => void; label: string }
) {
  const onChange = vi.fn()
  render(
    <GroupedEntityFilter
      label="Characters"
      groups={groups}
      onChange={onChange}
      options={options}
      getOptionLabel={(o: Option) => o.name}
      getOptionValue={(o: Option) => o.id}
      noneOption={noneOption}
    />
  )
  return { onChange }
}

describe('GroupedEntityFilter', () => {
  it('renders a single empty group by default', () => {
    renderFilter()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /add or group/i })).toBeInTheDocument()
  })

  it('does not show a none-toggle button when noneOption is not provided', () => {
    renderFilter()
    expect(screen.queryByRole('button', { name: /no .* assigned/i })).not.toBeInTheDocument()
  })

  it('clicking the none-toggle calls noneOption.onChange and does not touch the groups directly', async () => {
    const user = userEvent.setup()
    const onNoneChange = vi.fn()
    const { onChange } = renderFilter([['ishtar']], {
      checked: false,
      onChange: onNoneChange,
      label: 'No character assigned'
    })

    await user.click(screen.getByRole('button', { name: 'No character assigned' }))

    expect(onNoneChange).toHaveBeenCalledWith(true)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables the picker and "Add OR group" button while the "none" toggle is checked', () => {
    renderFilter([], { checked: true, onChange: vi.fn(), label: 'No character assigned' })

    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /add or group/i })).toBeDisabled()
  })

  it('only shows the none-toggle on the first group, not on additional OR-groups', () => {
    renderFilter([['ishtar'], ['rin']], {
      checked: false,
      onChange: vi.fn(),
      label: 'No character assigned'
    })

    expect(screen.getAllByRole('button', { name: 'No character assigned' })).toHaveLength(1)
  })

  it('calls onChange with an added empty group when "Add OR group" is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderFilter([['ishtar']])

    await user.click(screen.getByRole('button', { name: /add or group/i }))

    expect(onChange).toHaveBeenCalledWith([['ishtar'], []])
  })

  it('renders an OR divider and a combobox per group when there are multiple groups', () => {
    renderFilter([['ishtar'], ['rin']])

    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    expect(screen.getByText('OR')).toBeInTheDocument()
  })

  it('selecting an item in a group calls onChange with that group updated', async () => {
    const user = userEvent.setup()
    const { onChange } = renderFilter([['ishtar']])

    const [combobox] = screen.getAllByRole('combobox')
    await user.type(combobox, 'Ereshkigal')
    await user.click(await screen.findByRole('option', { name: 'Ereshkigal' }))

    expect(onChange).toHaveBeenCalledWith([['ishtar', 'ereshkigal']])
  })

  it('builds an OR-of-AND-groups query across two groups', async () => {
    const user = userEvent.setup()
    const { onChange } = renderFilter([['ishtar'], ['rin']])

    const [, secondCombobox] = screen.getAllByRole('combobox')
    await user.type(secondCombobox, 'Shirou')
    await user.click(await screen.findByRole('option', { name: 'Shirou' }))

    expect(onChange).toHaveBeenCalledWith([['ishtar'], ['rin', 'shirou']])
  })

  it('removes a group when its remove button is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderFilter([['ishtar'], ['rin']])

    const removeButtons = screen.getAllByRole('button', { name: /remove group/i })
    await user.click(removeButtons[1])

    expect(onChange).toHaveBeenCalledWith([['ishtar']])
  })

  it('does not show a remove button when there is only one group', () => {
    renderFilter([['ishtar']])
    expect(screen.queryByRole('button', { name: /remove group/i })).not.toBeInTheDocument()
  })

  it('exposes a tooltip explaining AND-within-group / OR-between-groups semantics', () => {
    renderFilter()
    expect(screen.getByLabelText(/items within a group must all match/i)).toBeInTheDocument()
  })

  it('shows the label exactly once, not duplicated by the inner combobox', () => {
    renderFilter([['ishtar']])

    expect(screen.getAllByText('Characters')).toHaveLength(1)
  })

  it('still names each group for assistive tech when there are several', () => {
    renderFilter([['ishtar'], ['rin']])

    expect(screen.getByRole('combobox', { name: 'Characters 1' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Characters 2' })).toBeInTheDocument()
  })
})
