// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GalleryToolbar } from './GalleryToolbar'

function renderToolbar(overrides: Partial<React.ComponentProps<typeof GalleryToolbar>> = {}) {
  const props: React.ComponentProps<typeof GalleryToolbar> = {
    total: 130,
    density: 'comfortable',
    onDensityChange: vi.fn(),
    pageSize: 60,
    onPageSizeChange: vi.fn(),
    page: 0,
    totalPages: 3,
    onPageChange: vi.fn(),
    ...overrides
  }
  return { ...render(<GalleryToolbar {...props} />), props }
}

describe('GalleryToolbar', () => {
  it('shows the item count', () => {
    renderToolbar({ total: 130 })
    expect(screen.getByText('Media count: 130')).toBeInTheDocument()
  })

  it('marks the active density button as pressed and the others as not', () => {
    renderToolbar({ density: 'large' })
    expect(screen.getByRole('button', { name: 'Large' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Comfortable' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('calls onDensityChange when a density button is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderToolbar({ density: 'comfortable' })

    await user.click(screen.getByRole('button', { name: 'Compact' }))
    expect(props.onDensityChange).toHaveBeenCalledWith('compact')
  })

  it('lists the page-size presets and calls onPageSizeChange on selection', async () => {
    const user = userEvent.setup()
    const { props } = renderToolbar({ pageSize: 60 })

    const select = screen.getByLabelText('Per page') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['24', '60', '120', '240'])

    await user.selectOptions(select, '120')
    expect(props.onPageSizeChange).toHaveBeenCalledWith(120)
  })

  it('hides pagination controls when there is no media', () => {
    renderToolbar({ total: 0, totalPages: 1 })
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('shows pagination controls when there is media', () => {
    renderToolbar({ total: 130, totalPages: 3, page: 0 })
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
  })
})
