// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PATH } from '../../app.routes.const'
import { readGallerySession, resetGallerySession } from '../../hooks/useGallerySession'
import { EntityCountButton } from './EntityCountButton'

afterEach(() => resetGallerySession())

function renderAtManage(ui: JSX.Element): void {
  render(
    <MemoryRouter initialEntries={['/manage']}>
      <Routes>
        <Route path="/manage" element={ui} />
        <Route path={PATH.GALLERY} element={<p>gallery</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EntityCountButton', () => {
  it('opens the gallery filtered to that entity only, from page 1', async () => {
    renderAtManage(<EntityCountButton kind="series" id="s1" name="Hololive" count={12} />)

    await userEvent.click(screen.getByRole('button', { name: /Hololive/ }))

    expect(screen.getByText('gallery')).toBeInTheDocument()
    const session = readGallerySession()
    expect(session?.filters.seriesGroups).toEqual([['s1']])
    expect(session?.filters.tagGroups).toBeUndefined()
    expect(session?.page).toBe(0)
  })

  it('is plain text when nothing would match', () => {
    renderAtManage(<EntityCountButton kind="tag" id="t1" name="Empty" count={0} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
