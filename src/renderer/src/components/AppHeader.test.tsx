// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('links to the home, gallery, library and settings routes', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/gallery')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/manage')
  })

  it('links the brand logo to home', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'PiCollection' })).toHaveAttribute('href', '/')
  })
})
