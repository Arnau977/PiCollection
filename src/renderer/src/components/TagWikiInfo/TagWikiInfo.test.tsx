// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagWikiInfo } from './TagWikiInfo'

const lookup = vi.fn()

beforeEach(() => {
  lookup.mockReset()
  Object.defineProperty(window, 'api', {
    value: { tagWiki: { lookup } },
    writable: true,
    configurable: true
  })
})

describe('TagWikiInfo', () => {
  it('fetches and shows the wiki body on click', async () => {
    lookup.mockResolvedValue({
      success: true,
      data: { tagName: 'cat_ears', body: 'A character with cat ears.', otherNames: ['nekomimi'] }
    })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="cat_ears" />)

    await user.click(screen.getByRole('button'))

    expect(lookup).toHaveBeenCalledWith('cat_ears')
    await waitFor(() => {
      expect(screen.getByText('A character with cat ears.')).toBeInTheDocument()
    })
    expect(screen.getByText(/nekomimi/)).toBeInTheDocument()
  })

  it('shows a not-found message when there is no wiki entry', async () => {
    lookup.mockResolvedValue({ success: true, data: null })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="made-up-tag" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('No Danbooru wiki entry found for this tag.')).toBeInTheDocument()
    })
  })

  it('shows the error message on failure', async () => {
    lookup.mockResolvedValue({
      success: false,
      error: {
        code: 'INTERNAL',
        message: 'Could not reach Danbooru. Check your internet connection.'
      }
    })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="cat_ears" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not reach Danbooru')
    })
  })

  it('does not re-fetch on a second click after already loaded, only toggles visibility', async () => {
    lookup.mockResolvedValue({
      success: true,
      data: { tagName: 'cat_ears', body: 'A character with cat ears.', otherNames: [] }
    })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="cat_ears" />)

    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('A character with cat ears.')).toBeInTheDocument())

    await user.click(screen.getByRole('button'))
    expect(screen.queryByText('A character with cat ears.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button'))
    expect(screen.getByText('A character with cat ears.')).toBeInTheDocument()
    expect(lookup).toHaveBeenCalledTimes(1)
  })
})
