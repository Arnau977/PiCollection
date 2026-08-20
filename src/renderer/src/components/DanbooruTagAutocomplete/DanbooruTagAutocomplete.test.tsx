// @vitest-environment jsdom
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DanbooruTagAutocomplete } from './DanbooruTagAutocomplete'

const autocompleteTags = vi.fn()
const getCredentials = vi.fn()

beforeEach(() => {
  autocompleteTags.mockReset().mockResolvedValue({ success: true, data: [] })
  getCredentials
    .mockReset()
    .mockResolvedValue({ success: true, data: { username: 'arnau', apiKey: 'abc123' } })
  Object.defineProperty(window, 'api', {
    value: { danbooru: { autocompleteTags, getCredentials } },
    writable: true,
    configurable: true
  })
})

function Wrapper(): JSX.Element {
  const [value, setValue] = useState('')
  return <DanbooruTagAutocomplete id="tag-name" value={value} onChange={setValue} />
}

describe('DanbooruTagAutocomplete', () => {
  it('still accepts typed input but never queries Danbooru without a configured account', async () => {
    getCredentials.mockResolvedValue({ success: true, data: undefined })
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.type(screen.getByRole('textbox'), 'cat')

    await waitFor(() => expect(getCredentials).toHaveBeenCalled())
    expect(screen.getByRole('textbox')).toHaveValue('cat')
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(autocompleteTags).not.toHaveBeenCalled()
  })

  it('does not query for a single character', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.type(screen.getByRole('textbox'), 'c')

    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(autocompleteTags).not.toHaveBeenCalled()
  })

  it('queries and shows suggestions once 2+ characters are typed, debounced', async () => {
    autocompleteTags.mockResolvedValue({
      success: true,
      data: [
        { name: 'cat_ears', postCount: 50000 },
        { name: 'cat_ears_(cosplay)', postCount: 20 }
      ]
    })
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.type(screen.getByRole('textbox'), 'cat')

    await waitFor(() => expect(autocompleteTags).toHaveBeenCalledWith('cat'))
    await waitFor(() => {
      expect(screen.getByText('cat_ears')).toBeInTheDocument()
      expect(screen.getByText('cat_ears_(cosplay)')).toBeInTheDocument()
    })
  })

  it('replaces the input value with the clicked suggestion', async () => {
    autocompleteTags.mockResolvedValue({
      success: true,
      data: [{ name: 'cat_ears', postCount: 50000 }]
    })
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.type(screen.getByRole('textbox'), 'cat')
    await waitFor(() => screen.getByText('cat_ears'))
    await user.click(screen.getByText('cat_ears'))

    expect(screen.getByRole('textbox')).toHaveValue('cat_ears')
    expect(screen.queryByText('cat_ears')).not.toBeInTheDocument()
  })

  it('silently shows no suggestions when the lookup fails', async () => {
    autocompleteTags.mockResolvedValue({
      success: false,
      error: { code: 'INTERNAL', message: 'offline' }
    })
    const user = userEvent.setup()
    render(<Wrapper />)

    await user.type(screen.getByRole('textbox'), 'cat')

    await waitFor(() => expect(autocompleteTags).toHaveBeenCalled())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it("renders the suggestion list outside the input's own DOM subtree", async () => {
    // Regression test: the list used to be an absolutely-positioned child of
    // the input's own wrapper, which got clipped by an ancestor's
    // `overflow-y: auto` (e.g. .manage-form-panel) - it must render as a
    // sibling of the app root (portaled), not nested under the input.
    autocompleteTags.mockResolvedValue({
      success: true,
      data: [{ name: 'cat_ears', postCount: 50000 }]
    })
    const user = userEvent.setup()
    const { container } = render(<Wrapper />)

    await user.type(screen.getByRole('textbox'), 'cat')
    await waitFor(() => screen.getByText('cat_ears'))

    expect(container.querySelector('.danbooru-tag-autocomplete-list')).not.toBeInTheDocument()
    expect(document.body.querySelector('.danbooru-tag-autocomplete-list')).toBeInTheDocument()
  })

  it('closes the suggestion list when clicking outside', async () => {
    autocompleteTags.mockResolvedValue({
      success: true,
      data: [{ name: 'cat_ears', postCount: 50000 }]
    })
    const user = userEvent.setup()
    render(
      <div>
        <Wrapper />
        <button type="button">elsewhere</button>
      </div>
    )

    await user.type(screen.getByRole('textbox'), 'cat')
    await waitFor(() => screen.getByText('cat_ears'))

    await user.click(screen.getByRole('button', { name: 'elsewhere' }))

    expect(screen.queryByText('cat_ears')).not.toBeInTheDocument()
  })
})
