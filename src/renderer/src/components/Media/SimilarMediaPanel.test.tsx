// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { MediaDuplicateMatch } from '@shared/models'
import { saveGalleryDefaults, FALLBACK_GALLERY_DEFAULTS } from '../../utils/gallerySettings'
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

function similarMediaResult(overrides: Partial<MediaDuplicateMatch['media']> = {}): {
  success: true
  data: MediaDuplicateMatch[]
} {
  return {
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
          pendingTagging: false,
          ...overrides
        },
        distance: 3
      }
    ]
  }
}

beforeEach(() => {
  findSimilarResult = { success: true, data: [] }
  setApi()
  window.localStorage.clear()
})

describe('SimilarMediaPanel', () => {
  it('renders nothing when there are no similar items', async () => {
    const { container } = renderPanel()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a thumbnail link to each similar media item', async () => {
    findSimilarResult = similarMediaResult()
    renderPanel()

    expect(await screen.findByRole('heading', { name: 'Similar media' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Other picture' })
    expect(link).toHaveAttribute('href', '/media/2')
  })

  it('blurs an NSFW similar item when blurNsfw is enabled (the default)', async () => {
    findSimilarResult = similarMediaResult({ sfw: false })
    const { container } = renderPanel()

    await screen.findByRole('link', { name: 'Other picture' })
    expect(container.querySelector('.similar-media-thumb-wrap.nsfw-blur')).not.toBeNull()
  })

  it('does not blur an SFW similar item', async () => {
    findSimilarResult = similarMediaResult({ sfw: true })
    const { container } = renderPanel()

    await screen.findByRole('link', { name: 'Other picture' })
    expect(container.querySelector('.similar-media-thumb-wrap.nsfw-blur')).toBeNull()
  })

  it('does not blur an NSFW similar item when blurNsfw is disabled', async () => {
    saveGalleryDefaults({ ...FALLBACK_GALLERY_DEFAULTS, blurNsfw: false })
    findSimilarResult = similarMediaResult({ sfw: false })
    const { container } = renderPanel()

    await screen.findByRole('link', { name: 'Other picture' })
    expect(container.querySelector('.similar-media-thumb-wrap.nsfw-blur')).toBeNull()
  })
})
