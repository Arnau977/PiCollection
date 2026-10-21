// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MediaModel } from '@shared/models'
import { MediaHoverPreview } from './MediaHoverPreview'

const media: MediaModel = {
  id: '1',
  type: 'image',
  route: 'C:/pics/a.png',
  name: 'a',
  sfw: true,
  isAiGenerated: false,
  createdAt: 0,
  pendingTagging: false,
  characters: [{ id: 'c1', name: 'Hayasaka', series: [], aliases: [], createdAt: 0 }],
  tags: [{ id: 't1', name: 'smile', createdAt: 0 }]
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  Object.defineProperty(window, 'api', {
    value: { media: { cacheThumbnail: vi.fn() } },
    writable: true,
    configurable: true
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('MediaHoverPreview', () => {
  it('stays open while the pointer moves onto the card, and closes on Esc', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MediaHoverPreview media={media}>a.png</MediaHoverPreview>)

    await user.hover(screen.getByText('a.png'))
    act(() => vi.advanceTimersByTime(200))
    const card = screen.getByText('Hayasaka').closest('.media-hover-preview-card') as HTMLElement
    expect(card).toHaveTextContent('smile')

    await user.hover(card)
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByText('Hayasaka')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByText('Hayasaka')).not.toBeInTheDocument()
  })
})
