// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { MediaDuplicateMatch } from '@shared/models'
import { SimilarMediaPanel } from './SimilarMediaPanel'

let findSimilarResult: { success: true; data: MediaDuplicateMatch[] }

function setApi(): void {
  Object.defineProperty(window, 'api', {
    value: { media: { findSimilar: vi.fn(() => Promise.resolve(findSimilarResult)) } },
    writable: true,
    configurable: true
  })
}

function renderPanel(mediaId = '1'): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <SimilarMediaPanel mediaId={mediaId} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  findSimilarResult = { success: true, data: [] }
  setApi()
})

describe('SimilarMediaPanel', () => {
  it('renders nothing when there are no similar items', async () => {
    const { container } = renderPanel()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a thumbnail link to each similar media item', async () => {
    findSimilarResult = {
      success: true,
      data: [
        {
          media: {
            id: '2',
            name: 'Other picture',
            type: 'image',
            route: '/pics/2.png',
            sfw: true,
            isAiGenerated: false,
            createdAt: 1,
            pendingTagging: false
          },
          distance: 3
        }
      ]
    }
    renderPanel()

    expect(await screen.findByRole('heading', { name: 'Similar media' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Other picture' })
    expect(link).toHaveAttribute('href', '/media/2')
  })
})
