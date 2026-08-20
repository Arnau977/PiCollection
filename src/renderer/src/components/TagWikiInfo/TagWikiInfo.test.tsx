// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagWikiInfo } from './TagWikiInfo'

const lookup = vi.fn()
const getCredentials = vi.fn()

beforeEach(() => {
  lookup.mockReset()
  getCredentials
    .mockReset()
    .mockResolvedValue({ success: true, data: { username: 'arnau', apiKey: 'abc123' } })
  Object.defineProperty(window, 'api', {
    value: { tagWiki: { lookup }, danbooru: { getCredentials } },
    writable: true,
    configurable: true
  })
})

describe('TagWikiInfo', () => {
  it('does not render when no Danbooru account is configured', async () => {
    getCredentials.mockResolvedValue({ success: true, data: undefined })
    render(<TagWikiInfo tagName="cat_ears" />)

    await waitFor(() => expect(getCredentials).toHaveBeenCalled())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('fetches and shows the wiki body on click', async () => {
    lookup.mockResolvedValue({
      success: true,
      data: { tagName: 'cat_ears', body: 'A character with cat ears.', otherNames: ['nekomimi'] }
    })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="cat_ears" />)

    await user.click(await screen.findByRole('button'))

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

    await user.click(await screen.findByRole('button'))

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

    await user.click(await screen.findByRole('button'))

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

    const button = await screen.findByRole('button')
    await user.click(button)
    await waitFor(() => expect(screen.getByText('A character with cat ears.')).toBeInTheDocument())

    await user.click(button)
    expect(screen.queryByText('A character with cat ears.')).not.toBeInTheDocument()

    await user.click(button)
    expect(screen.getByText('A character with cat ears.')).toBeInTheDocument()
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('closes when clicking outside the popover', async () => {
    lookup.mockResolvedValue({
      success: true,
      data: { tagName: 'cat_ears', body: 'A character with cat ears.', otherNames: [] }
    })
    const user = userEvent.setup()
    render(
      <div>
        <TagWikiInfo tagName="cat_ears" />
        <button type="button">elsewhere</button>
      </div>
    )

    await user.click(await screen.findByRole('button', { name: /What does this tag mean/ }))
    await waitFor(() => expect(screen.getByText('A character with cat ears.')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'elsewhere' }))

    expect(screen.queryByText('A character with cat ears.')).not.toBeInTheDocument()
  })

  it('strips DText markup from the wiki body before displaying it', async () => {
    lookup.mockResolvedValue({
      success: true,
      data: {
        tagName: 'bottomless',
        body: '[b]Do not use[/b] when the character is wearing [[pantyhose]].',
        otherNames: []
      }
    })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="bottomless" />)

    await user.click(await screen.findByRole('button'))

    await waitFor(() => {
      expect(
        screen.getByText('Do not use when the character is wearing pantyhose.')
      ).toBeInTheDocument()
    })
  })

  it('renders a "post #N" reference as a link to that Danbooru post', async () => {
    lookup.mockResolvedValue({
      success: true,
      data: { tagName: 'ass', body: 'Examples\n* !post #8241273', otherNames: [] }
    })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="ass" />)

    await user.click(await screen.findByRole('button'))

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'post #8241273' })
      expect(link).toHaveAttribute('href', 'https://danbooru.donmai.us/posts/8241273')
      expect(link).toHaveAttribute('target', '_blank')
    })
  })

  it('renders a "pool #N" reference as a link to that Danbooru pool', async () => {
    lookup.mockResolvedValue({
      success: true,
      data: {
        tagName: 'cute',
        body: 'Related pools\n* pool #903: Disgustingly Adorable',
        otherNames: []
      }
    })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="cute" />)

    await user.click(await screen.findByRole('button'))

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'pool #903' })
      expect(link).toHaveAttribute('href', 'https://danbooru.donmai.us/pools/903')
    })
  })

  it('renders a {{pool:Name}} reference as a link with a readable label', async () => {
    lookup.mockResolvedValue({
      success: true,
      data: {
        tagName: 'cute',
        body: 'See {{pool:Disgustingly_Adorable}} instead.',
        otherNames: []
      }
    })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="cute" />)

    await user.click(await screen.findByRole('button'))

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Disgustingly Adorable' })
      expect(link).toHaveAttribute(
        'href',
        'https://danbooru.donmai.us/posts?tags=pool%3ADisgustingly_Adorable'
      )
    })
  })

  it('renders "*" bullet markers as dashes instead of the raw asterisk', async () => {
    lookup.mockResolvedValue({
      success: true,
      data: { tagName: 'ass', body: '* first point\n* second point', otherNames: [] }
    })
    const user = userEvent.setup()
    render(<TagWikiInfo tagName="ass" />)

    await user.click(await screen.findByRole('button'))

    await waitFor(() => {
      expect(screen.getByText(/- first point/)).toBeInTheDocument()
      expect(screen.getByText(/- second point/)).toBeInTheDocument()
    })
  })
})
