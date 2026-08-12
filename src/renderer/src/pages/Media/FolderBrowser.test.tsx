// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FolderBrowser } from './FolderBrowser'

const browse = vi.fn()

beforeEach(() => {
  browse.mockReset()
  Object.defineProperty(window, 'api', {
    value: { sourceFolder: { browse } },
    writable: true,
    configurable: true
  })
})

describe('FolderBrowser', () => {
  it('lists folders and files returned by browse for the root path', async () => {
    browse.mockResolvedValue({
      success: true,
      data: {
        folders: [{ name: 'Genshin', relativePath: 'Genshin' }],
        files: [{ name: 'a.png', relativePath: 'a.png', type: 'image', cataloged: false }]
      }
    })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    expect(await screen.findByText('Genshin')).toBeInTheDocument()
    expect(await screen.findByText('a.png')).toBeInTheDocument()
    expect(browse).toHaveBeenCalledWith('')
  })

  it('navigates into a folder on double click and re-browses that path', async () => {
    browse.mockResolvedValueOnce({
      success: true,
      data: { folders: [{ name: 'Genshin', relativePath: 'Genshin' }], files: [] }
    })
    browse.mockResolvedValueOnce({
      success: true,
      data: {
        folders: [],
        files: [{ name: 'b.png', relativePath: 'Genshin/b.png', type: 'image', cataloged: false }]
      }
    })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    const folderTile = await screen.findByText('Genshin')
    fireEvent.doubleClick(folderTile)

    expect(await screen.findByText('b.png')).toBeInTheDocument()
    expect(browse).toHaveBeenLastCalledWith('Genshin')
  })

  it('a single click selects a file, and Import selected fires onStartImport with it', async () => {
    browse.mockResolvedValue({
      success: true,
      data: {
        folders: [],
        files: [{ name: 'a.png', relativePath: 'a.png', type: 'image', cataloged: false }]
      }
    })
    const onStartImport = vi.fn()

    render(<FolderBrowser onStartImport={onStartImport} />)

    const fileTile = await screen.findByText('a.png')
    fireEvent.click(fileTile)
    fireEvent.click(screen.getByRole('button', { name: /Import selected/ }))

    expect(onStartImport).toHaveBeenCalledWith({ files: ['a.png'], folders: [] })
  })

  it('a single click selects a folder without navigating, feeding it to onStartImport', async () => {
    browse.mockResolvedValue({
      success: true,
      data: { folders: [{ name: 'Genshin', relativePath: 'Genshin' }], files: [] }
    })
    const onStartImport = vi.fn()

    render(<FolderBrowser onStartImport={onStartImport} />)

    const folderTile = await screen.findByText('Genshin')
    fireEvent.click(folderTile)
    // Selecting a folder is deferred briefly so a following double-click can
    // cancel it instead of flashing the selected state before navigating away.
    await new Promise((resolve) => setTimeout(resolve, 250))
    fireEvent.click(screen.getByRole('button', { name: /Import selected/ }))

    expect(onStartImport).toHaveBeenCalledWith({ files: [], folders: ['Genshin'] })
    expect(browse).toHaveBeenCalledTimes(1)
  })

  it('disables a cataloged file so it cannot be selected', async () => {
    browse.mockResolvedValue({
      success: true,
      data: {
        folders: [],
        files: [{ name: 'a.png', relativePath: 'a.png', type: 'image', cataloged: true }]
      }
    })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    const fileTile = (await screen.findByText('a.png')).closest('button') as HTMLButtonElement
    expect(fileTile).toBeDisabled()
  })

  it('shows an error message when browse fails', async () => {
    browse.mockResolvedValue({
      success: false,
      error: { code: 'INTERNAL', message: 'Folder is gone' }
    })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    expect(await screen.findByText('Folder is gone')).toBeInTheDocument()
  })

  it('disables Import selected when nothing is selected', async () => {
    browse.mockResolvedValue({ success: true, data: { folders: [], files: [] } })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /Import selected/ })).toBeDisabled()
  })

  it('retries the same folder when Retry is clicked after a browse error', async () => {
    browse.mockResolvedValueOnce({
      success: false,
      error: { code: 'INTERNAL', message: 'Folder is gone' }
    })
    browse.mockResolvedValueOnce({
      success: true,
      data: {
        folders: [],
        files: [{ name: 'a.png', relativePath: 'a.png', type: 'image', cataloged: false }]
      }
    })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    expect(await screen.findByText('Folder is gone')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('a.png')).toBeInTheDocument()
    expect(browse).toHaveBeenCalledTimes(2)
    expect(browse).toHaveBeenNthCalledWith(2, '')
  })

  it('paginates the file grid and only shows folders on the first page', async () => {
    const files = Array.from({ length: 130 }, (_, i) => ({
      name: `file-${i}.png`,
      relativePath: `file-${i}.png`,
      type: 'image' as const,
      cataloged: false
    }))
    browse.mockResolvedValue({
      success: true,
      data: { folders: [{ name: 'sub', relativePath: 'sub' }], files }
    })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    await screen.findByText('file-0.png')
    expect(screen.getAllByText(/^file-\d+\.png$/)).toHaveLength(40)
    expect(screen.getByText('sub')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('file-40.png')).toBeInTheDocument()
    expect(screen.queryByText('file-0.png')).not.toBeInTheDocument()
    expect(screen.queryByText('sub')).not.toBeInTheDocument()
  })

  it('resets to page 1 when navigating into a different folder', async () => {
    const files = Array.from({ length: 70 }, (_, i) => ({
      name: `file-${i}.png`,
      relativePath: `file-${i}.png`,
      type: 'image' as const,
      cataloged: false
    }))
    browse.mockResolvedValueOnce({ success: true, data: { folders: [], files } })
    browse.mockResolvedValueOnce({ success: true, data: { folders: [], files: [] } })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    await screen.findByText('file-0.png')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('file-40.png')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Source folder' }))

    expect(browse).toHaveBeenLastCalledWith('')
    expect(screen.queryByText('file-40.png')).not.toBeInTheDocument()
  })
})
