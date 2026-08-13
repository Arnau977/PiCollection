// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Images } from 'lucide-react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the title and hint', () => {
    render(<EmptyState icon={<Images />} title="No media yet" hint="Add something" />)
    expect(screen.getByText('No media yet')).toBeInTheDocument()
    expect(screen.getByText('Add something')).toBeInTheDocument()
  })

  it('renders an onClick action as a button', async () => {
    const onClick = vi.fn()
    render(
      <EmptyState icon={<Images />} title="No media yet" action={{ label: 'Do it', onClick }} />
    )
    const button = screen.getByRole('button', { name: 'Do it' })
    await button.click()
    expect(onClick).toHaveBeenCalled()
  })

  it('renders a `to` action as a link', () => {
    render(
      <MemoryRouter>
        <EmptyState icon={<Images />} title="No media yet" action={{ label: 'Go', to: '/add' }} />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/add')
  })

  it('renders no action when none is given', () => {
    render(<EmptyState icon={<Images />} title="No media yet" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
