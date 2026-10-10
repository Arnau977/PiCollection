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
        folders: [{ name: 'Genshin', relativePath: 'Genshin', fileCount: 3 }],
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
      data: { folders: [{ name: 'Genshin', relativePath: 'Genshin', fileCount: 1 }], files: [] }
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

  it('a single click selects a file, and Import fires onStartImport with it', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /^Import \d+ files?$/ }))

    expect(onStartImport).toHaveBeenCalledWith({ files: ['a.png'], folders: [] })
  })

  it('a single click selects a folder without navigating, feeding it to onStartImport', async () => {
    browse.mockResolvedValue({
      success: true,
      data: { folders: [{ name: 'Genshin', relativePath: 'Genshin', fileCount: 2 }], files: [] }
    })
    const onStartImport = vi.fn()

    render(<FolderBrowser onStartImport={onStartImport} />)

    const folderTile = await screen.findByText('Genshin')
    fireEvent.click(folderTile)
    // Selecting a folder is deferred briefly so a following double-click can
    // cancel it instead of flashing the selected state before navigating away.
    await new Promise((resolve) => setTimeout(resolve, 250))
    fireEvent.click(screen.getByRole('button', { name: /^Import \d+ files?$/ }))

    expect(onStartImport).toHaveBeenCalledWith({ files: [], folders: ['Genshin'] })
    expect(browse).toHaveBeenCalledTimes(1)
  })

  it("counts the files to import, not the selected tiles, without counting a folder's contents twice", async () => {
    browse.mockImplementation(async (path: string) => ({
      success: true,
      data:
        path === 'A'
          ? {
              folders: [{ name: 'B', relativePath: 'A\\B', fileCount: 2 }],
              files: [{ name: 'x.png', relativePath: 'A\\x.png', type: 'image', cataloged: false }]
            }
          : {
              folders: [
                { name: 'A', relativePath: 'A', fileCount: 4 },
                { name: 'C', relativePath: 'C', fileCount: 3 }
              ],
              files: []
            }
    }))
    const selectFolder = async (name: string): Promise<void> => {
      fireEvent.click(await screen.findByText(name))
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    render(<FolderBrowser onStartImport={vi.fn()} />)

    await selectFolder('A')
    await selectFolder('C')
    expect(screen.getByRole('button', { name: 'Import 7 files' })).toBeEnabled()

    // Inside A, already counted in its 4: still 7.
    fireEvent.doubleClick(screen.getByText('A'))
    await selectFolder('B')
    fireEvent.click(await screen.findByText('x.png'))
    expect(screen.getByRole('button', { name: 'Import 7 files' })).toBeInTheDocument()
  })

  it('disables cataloged and discarded files so they cannot be selected', async () => {
    browse.mockResolvedValue({
      success: true,
      data: {
        folders: [],
        files: [
          {
            name: 'a.png',
            relativePath: 'a.png',
            type: 'image',
            cataloged: true,
            discarded: false
          },
          { name: 'b.png', relativePath: 'b.png', type: 'image', cataloged: false, discarded: true }
        ]
      }
    })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    expect((await screen.findByText('a.png')).closest('button')).toBeDisabled()
    expect(screen.getByText('b.png').closest('button')).toBeDisabled()
    expect(screen.getByText('Discarded')).toBeInTheDocument()
  })

  it('shows an error message when browse fails', async () => {
    browse.mockResolvedValue({
      success: false,
      error: { code: 'INTERNAL', message: 'Folder is gone' }
    })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    expect(await screen.findByText('Folder is gone')).toBeInTheDocument()
  })

  it('disables Import when nothing is selected', async () => {
    browse.mockResolvedValue({ success: true, data: { folders: [], files: [] } })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /^Import \d+ files?$/ })).toBeDisabled()
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
      data: { folders: [{ name: 'sub', relativePath: 'sub', fileCount: 7 }], files }
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

  it('hides folders with nothing left to import until asked, and never selects them', async () => {
    browse.mockResolvedValue({
      success: true,
      data: {
        folders: [
          { name: 'Genshin', relativePath: 'Genshin', fileCount: 5 },
          { name: 'Done', relativePath: 'Done', fileCount: 0 }
        ],
        files: []
      }
    })

    render(<FolderBrowser onStartImport={vi.fn()} />)

    await screen.findByText('Genshin')
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.queryByText('Done')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Show 1 folder with nothing left to import'))
    fireEvent.click(screen.getByText('Done'))
    await new Promise((resolve) => setTimeout(resolve, 250))

    expect(screen.getByText('Nothing left')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Import \d+ files?$/ })).toBeDisabled()
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

  describe('bulk selection', () => {
    const fourFiles = ['a', 'b', 'c', 'd'].map((name) => ({
      name: `${name}.png`,
      relativePath: `${name}.png`,
      type: 'image',
      cataloged: name === 'c'
    }))

    function importButton(): HTMLElement {
      return screen.getByRole('button', { name: /^Import \d+ files?$/ })
    }

    beforeEach(() => {
      browse.mockResolvedValue({ success: true, data: { folders: [], files: fourFiles } })
    })

    it('Shift+click selects the range from the last clicked tile, skipping added files', async () => {
      const onStartImport = vi.fn()
      render(<FolderBrowser onStartImport={onStartImport} />)

      fireEvent.click(await screen.findByText('a.png'))
      fireEvent.click(screen.getByText('d.png'), { shiftKey: true })
      fireEvent.click(importButton())

      expect(onStartImport).toHaveBeenCalledWith({
        files: ['a.png', 'b.png', 'd.png'],
        folders: []
      })
    })

    it('Ctrl+A selects every pickable file and Esc clears them', async () => {
      render(<FolderBrowser onStartImport={vi.fn()} />)
      await screen.findByText('a.png')

      fireEvent.keyDown(document, { key: 'a', ctrlKey: true })
      expect(importButton()).toHaveTextContent('Import 3 files')

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(importButton()).toBeDisabled()
    })

    it('dragging a rectangle over tiles selects them without also toggling the first one', async () => {
      const onStartImport = vi.fn()
      render(<FolderBrowser onStartImport={onStartImport} />)
      await screen.findByText('a.png')
      // jsdom has no layout: put the tiles in a row, 100px apart.
      for (const [i, name] of ['a', 'b', 'c', 'd'].entries()) {
        const tile = screen.getByText(`${name}.png`).closest('button')!
        tile.getBoundingClientRect = () => new DOMRect(i * 100, 0, 90, 90)
      }

      fireEvent.mouseDown(screen.getByText('a.png'), { button: 0, clientX: 10, clientY: 10 })
      fireEvent.mouseMove(window, { clientX: 150, clientY: 50 })
      fireEvent.mouseUp(window)
      fireEvent.click(screen.getByText('a.png'))
      fireEvent.click(importButton())

      expect(onStartImport).toHaveBeenCalledWith({ files: ['a.png', 'b.png'], folders: [] })
    })
  })
})
